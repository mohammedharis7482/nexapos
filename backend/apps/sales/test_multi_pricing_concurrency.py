"""Real threaded concurrency tests for multi-pricing stock deduction.

TransactionTestCase (not TestCase) so worker threads on their own
connections really see each other's committed rows - the same pattern as
test_concurrency.py, and deliberately reusing the existing balance lock in
add_product_to_draft/complete_sale rather than adding a second scheme.
"""

import threading
from decimal import Decimal

from django.db import connection, transaction
from django.test import TransactionTestCase
from django.test.utils import CaptureQueriesContext

from apps.accounts.models import User
from apps.inventory.models import InventoryBalance
from apps.products.models import Product, ProductPacket
from apps.sales.exceptions import BillingOperationError
from apps.sales.models import Sale, SaleItem
from apps.sales.services import (
    add_product_to_draft,
    complete_sale,
    create_draft_sale,
    open_shift,
)
from apps.shops.models import Shop

PASSWORD = "MultiPricingConcurrencyPassword123!"


class MultiPricingConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.shop = Shop.objects.create(
            name="Concurrent Pricing Grocery",
            address="Doha",
            phone="+97450009401",
            status=Shop.Status.ACTIVE,
        )
        self.rice = Product.objects.create(
            shop=self.shop,
            name="Basmati Rice",
            sku="RICE-CONC",
            unit=Product.Unit.KG,
            selling_price=Decimal("12.00"),
            pricing_mode=Product.PricingMode.MULTI,
        )
        self.packet = ProductPacket.objects.create(
            product=self.rice, size=Decimal("1.000"), price=Decimal("12.00")
        )
        self.balance = InventoryBalance.objects.create(
            shop=self.shop,
            product=self.rice,
            quantity_on_hand=Decimal("4.000"),
            low_stock_threshold=Decimal("0.000"),
        )

    def _cashier(self, index: int) -> User:
        user = User.objects.create_user(
            shop=self.shop,
            username=f"conc_cashier_{index}",
            password=PASSWORD,
            full_name=f"Cashier {index}",
            role=User.Role.OWNER,
        )
        open_shift(user=user)
        return user

    def on_hand(self) -> Decimal:
        self.balance.refresh_from_db()
        return self.balance.quantity_on_hand

    def _run_concurrent_checkouts(self, specs):
        """Each spec is (pricing_mode, quantity, packet). One thread apiece.

        Every draft is prepared up front, so the barrier releases the threads
        directly into the locked completion path - the window where a lost
        update would actually happen.
        """
        prepared = []
        for index, (mode, quantity, packet) in enumerate(specs):
            user = self._cashier(index)
            sale = create_draft_sale(user=user)
            add_product_to_draft(
                sale_id=sale.pk,
                user=user,
                product_id=self.rice.pk,
                quantity=quantity,
                pricing_mode=mode,
                packet_id=packet.pk if packet else None,
            )
            prepared.append((user, sale))

        barrier = threading.Barrier(len(prepared))
        outcomes: list = [None] * len(prepared)

        def worker(index, user, sale):
            try:
                sale.refresh_from_db()
                total = sale.grand_total
                barrier.wait(timeout=10)
                complete_sale(
                    sale_id=sale.pk,
                    user=user,
                    payments=[{"method": "CASH", "amount": total}],
                    amount_received=total,
                )
                outcomes[index] = "completed"
            except BillingOperationError as exc:
                outcomes[index] = f"rejected: {exc.field}"
            except Exception as exc:  # surfaced in the assertion message
                outcomes[index] = f"error: {exc!r}"
            finally:
                connection.close()

        threads = [
            threading.Thread(target=worker, args=(index, user, sale))
            for index, (user, sale) in enumerate(prepared)
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=30)
        return outcomes

    def test_concurrent_packet_and_loose_checkouts_never_lose_a_deduction(self):
        """Four sales that all fit: the pool must end at exactly the sum.

        A lost update - two threads reading the same quantity_on_hand and both
        writing back their own result - would leave stock too high here.
        """
        specs = [
            (SaleItem.PricingMode.PACKET, Decimal("1"), self.packet),
            (SaleItem.PricingMode.LOOSE, Decimal("0.500"), None),
            (SaleItem.PricingMode.PACKET, Decimal("1"), self.packet),
            (SaleItem.PricingMode.LOOSE, Decimal("0.500"), None),
        ]
        outcomes = self._run_concurrent_checkouts(specs)
        self.assertEqual(
            outcomes, ["completed"] * 4, f"a checkout that should fit failed: {outcomes}"
        )
        # 1.000 + 0.500 + 1.000 + 0.500 drawn from one 4.000 pool.
        self.assertEqual(self.on_hand(), Decimal("1.000"))

    def test_concurrent_oversubscription_is_rejected_not_driven_negative(self):
        """Six one-kilo demands against a four-kilo pool.

        Exactly four may succeed; the rest must be rejected. Stock must never
        land below zero, whichever mode wins the race.
        """
        specs = [
            (SaleItem.PricingMode.PACKET, Decimal("1"), self.packet),
            (SaleItem.PricingMode.LOOSE, Decimal("1.000"), None),
            (SaleItem.PricingMode.PACKET, Decimal("1"), self.packet),
            (SaleItem.PricingMode.LOOSE, Decimal("1.000"), None),
            (SaleItem.PricingMode.PACKET, Decimal("1"), self.packet),
            (SaleItem.PricingMode.LOOSE, Decimal("1.000"), None),
        ]
        outcomes = self._run_concurrent_checkouts(specs)
        completed = outcomes.count("completed")
        self.assertGreaterEqual(self.on_hand(), Decimal("0.000"), "stock went negative")
        self.assertEqual(
            completed, 4, f"expected exactly 4 of 6 to fit 4.000 kg: {outcomes}"
        )
        self.assertEqual(self.on_hand(), Decimal("0.000"))
        self.assertEqual(
            Sale.objects.filter(status=Sale.Status.COMPLETED).count(), 4
        )
        for outcome in outcomes:
            self.assertIn(
                outcome,
                ("completed", "rejected: inventory"),
                f"unexpected failure mode: {outcome}",
            )

    def test_completion_locks_the_shared_balance_not_a_per_mode_row(self):
        """Proves the deduction reuses the existing balance lock.

        Packet and loose sales must contend on the one inventory_balance row.
        A separate lock per pricing mode would let the two modes deduct
        concurrently and drift apart, which is precisely what a single shared
        pool is meant to prevent.
        """
        user = self._cashier(0)
        sale = create_draft_sale(user=user)
        add_product_to_draft(
            sale_id=sale.pk, user=user, product_id=self.rice.pk,
            quantity=Decimal("1"),
            pricing_mode=SaleItem.PricingMode.PACKET, packet_id=self.packet.pk,
        )
        sale.refresh_from_db()
        with CaptureQueriesContext(connection) as captured:
            with transaction.atomic():
                complete_sale(
                    sale_id=sale.pk, user=user,
                    payments=[{"method": "CASH", "amount": sale.grand_total}],
                    amount_received=sale.grand_total,
                )
        locking = [
            query["sql"]
            for query in captured.captured_queries
            if "FOR UPDATE" in query["sql"].upper()
        ]
        self.assertTrue(
            any("inventory_inventorybalance" in sql for sql in locking),
            f"the shared balance row was never locked: {locking}",
        )
        self.assertFalse(
            any("products_productpacket" in sql for sql in locking),
            f"packets must not be locked as a parallel stock row: {locking}",
        )
