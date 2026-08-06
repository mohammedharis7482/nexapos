"""Real threaded concurrency tests for sale-number generation.

TransactionTestCase (not TestCase) so worker threads on their own
connections really see each other's committed rows.
"""

import threading
from decimal import Decimal

from django.db import connection, transaction
from django.test import TransactionTestCase
from django.test.utils import CaptureQueriesContext

from apps.accounts.models import User
from apps.inventory.models import InventoryBalance
from apps.products.models import Product
from apps.sales.exceptions import BillingOperationError
from apps.sales.models import CashierShift, Sale, SaleSequence
from apps.sales.services import (
    _next_sale_number,
    add_product_to_draft,
    complete_sale,
    create_draft_sale,
)
from apps.shops.models import Shop

PASSWORD = "SaleNumberConcurrencyPassword123!"


class SaleNumberConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.shop = Shop.objects.create(
            name="Sale Number Grocery",
            address="Doha",
            phone="+97450009101",
            status=Shop.Status.ACTIVE,
        )
        self.owner = User.objects.create_user(
            shop=self.shop,
            username="seq_owner",
            password=PASSWORD,
            full_name="Sequence Owner",
            role=User.Role.OWNER,
        )

    def _draft(self):
        return Sale.objects.create(shop=self.shop, created_by=self.owner)

    def test_concurrent_generation_never_produces_a_duplicate_sale_number(self):
        """The invariant that must hold before and after narrowing the lock.

        A duplicate invoice number is unacceptable regardless of how the
        mutex is scoped, so this guards the correctness property while the
        test below asserts the scope actually narrowed.
        """
        worker_count = 10
        barrier = threading.Barrier(worker_count)
        numbers: list = [None] * worker_count

        def worker(index):
            try:
                sale = self._draft()
                barrier.wait(timeout=10)
                with transaction.atomic():
                    numbers[index] = _next_sale_number(sale=sale)
            finally:
                connection.close()

        threads = [
            threading.Thread(target=worker, args=(i,)) for i in range(worker_count)
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=30)

        issued = [n for n in numbers if n]
        self.assertEqual(len(issued), worker_count, f"some workers failed: {numbers}")
        self.assertEqual(
            len(set(issued)),
            worker_count,
            f"duplicate sale numbers issued concurrently: {sorted(issued)}",
        )
        # The counter must also be strictly contiguous - a gap would mean an
        # increment was lost even though the strings happened to differ.
        sequence = SaleSequence.objects.get(shop=self.shop)
        self.assertEqual(sequence.last_value, worker_count)

    def test_lock_is_scoped_to_the_sequence_row_not_the_whole_shop(self):
        """Proves the contention fix, not just the correctness invariant.

        Locking shops_shop as the mutex serialised every checkout in a shop
        against every other checkout *and* against unrelated shop writes
        (settings, onboarding, quota enforcement). The mutex must be the
        per-shop-per-day sequence row instead.
        """
        sale = self._draft()
        with CaptureQueriesContext(connection) as captured:
            with transaction.atomic():
                _next_sale_number(sale=sale)

        locking = [
            q["sql"] for q in captured.captured_queries if "FOR UPDATE" in q["sql"].upper()
        ]
        self.assertTrue(locking, "expected a row lock to be taken")
        self.assertTrue(
            any("sales_salesequence" in sql for sql in locking),
            f"sequence row was never locked: {locking}",
        )
        self.assertFalse(
            any("shops_shop" in sql for sql in locking),
            f"shop row is still being locked as the mutex: {locking}",
        )

    def test_numbers_are_per_shop_so_two_shops_do_not_block_each_other(self):
        other_shop = Shop.objects.create(
            name="Other Sequence Grocery",
            address="Al Wakrah",
            phone="+97450009102",
            status=Shop.Status.ACTIVE,
        )
        other_owner = User.objects.create_user(
            shop=other_shop,
            username="seq_owner_other",
            password=PASSWORD,
            full_name="Other Sequence Owner",
            role=User.Role.OWNER,
        )
        with transaction.atomic():
            first = _next_sale_number(sale=self._draft())
        with transaction.atomic():
            second = _next_sale_number(
                sale=Sale.objects.create(shop=other_shop, created_by=other_owner)
            )

        # Independent counters: both shops start at 000001 but the embedded
        # shop code keeps the full numbers distinct.
        self.assertTrue(first.endswith("-000001"), first)
        self.assertTrue(second.endswith("-000001"), second)
        self.assertNotEqual(first, second)


class ConcurrentCheckoutTests(TransactionTestCase):
    """End-to-end concurrent checkouts through complete_sale.

    complete_sale takes several row locks in sequence (draft sale, shift,
    sale items, inventory balance, then the sale-number counter). Narrowing
    the counter lock changes that chain, so this exercises the real path to
    prove the change introduces neither a deadlock nor an oversell.
    """

    reset_sequences = True

    def setUp(self):
        self.shop = Shop.objects.create(
            name="Concurrent Checkout Grocery",
            address="Doha",
            phone="+97450009201",
            status=Shop.Status.ACTIVE,
        )
        self.cashiers = []
        for index in range(6):
            cashier = User.objects.create_user(
                shop=self.shop,
                username=f"register_{index}",
                password=PASSWORD,
                full_name=f"Register {index}",
                role=User.Role.CASHIER,
            )
            CashierShift.objects.create(
                shop=self.shop,
                cashier=cashier,
                opened_by=cashier,
                opening_cash=Decimal("100.00"),
            )
            self.cashiers.append(cashier)

        self.product = Product.objects.create(
            shop=self.shop,
            name="Contended Product",
            sku="CONTENDED",
            selling_price=Decimal("10.00"),
        )
        # Exactly 4 units for 6 concurrent single-unit sales, so the last
        # two must be rejected rather than overselling into negative stock.
        InventoryBalance.objects.create(
            shop=self.shop,
            product=self.product,
            quantity_on_hand=Decimal("4.000"),
        )

    def test_concurrent_checkouts_do_not_oversell_deadlock_or_duplicate_numbers(self):
        worker_count = len(self.cashiers)
        barrier = threading.Barrier(worker_count)
        outcomes: list = [None] * worker_count

        def worker(index):
            cashier = self.cashiers[index]
            try:
                draft = create_draft_sale(user=cashier)
                add_product_to_draft(
                    sale_id=draft.id,
                    user=cashier,
                    product_id=self.product.id,
                    quantity=Decimal("1"),
                )
                draft.refresh_from_db()
                barrier.wait(timeout=10)
                completed = complete_sale(
                    sale_id=draft.id,
                    user=cashier,
                    payments=[{"method": "CASH", "amount": draft.grand_total}],
                    amount_received=draft.grand_total,
                )
                outcomes[index] = ("sold", completed.sale_number)
            except BillingOperationError as exc:
                outcomes[index] = ("rejected", exc.message)
            except Exception as exc:
                outcomes[index] = ("error", f"{type(exc).__name__}: {exc}")
            finally:
                connection.close()

        threads = [
            threading.Thread(target=worker, args=(i,)) for i in range(worker_count)
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=60)

        errors = [o for o in outcomes if o and o[0] == "error"]
        self.assertEqual(errors, [], f"unexpected failures (deadlock?): {errors}")

        sold = [o[1] for o in outcomes if o and o[0] == "sold"]
        self.assertEqual(
            len(set(sold)), len(sold), f"duplicate sale numbers: {sorted(sold)}"
        )

        balance = InventoryBalance.objects.get(product=self.product)
        self.assertGreaterEqual(
            balance.quantity_on_hand,
            Decimal("0.000"),
            "stock went negative under concurrent checkout",
        )
        self.assertEqual(
            balance.quantity_on_hand,
            Decimal("4.000") - Decimal(len(sold)),
            "deducted stock does not match the number of completed sales",
        )
        self.assertEqual(
            Sale.objects.filter(
                shop=self.shop, status=Sale.Status.COMPLETED
            ).count(),
            len(sold),
        )
