"""Real threaded concurrency tests for plan-quota enforcement.

These use TransactionTestCase (not TestCase) deliberately: TestCase wraps
each test in a transaction that is never committed, so worker threads on
their own connections could not see each other's rows and the race under
test would be invisible.
"""

import threading
from decimal import Decimal

from django.db import connection
from django.test import TransactionTestCase

from apps.accounts.models import User
from apps.products.models import Product
from apps.products.services import create_product
from apps.saas.models import Plan, ShopSubscription
from apps.saas.services import SaasOperationError, create_staff_user
from apps.shops.models import Shop

PASSWORD = "ConcurrencyFoundationPassword123!"


def run_concurrently(target, count):
    """Run `target(i)` in `count` threads released simultaneously.

    Each worker closes its own DB connection so Django does not reuse a
    connection across threads, and a barrier maximises the overlap so the
    check-then-insert windows genuinely interleave.
    """
    barrier = threading.Barrier(count)
    results: list = [None] * count

    def worker(index):
        try:
            barrier.wait(timeout=10)
            results[index] = ("ok", target(index))
        except SaasOperationError as exc:
            results[index] = ("rejected", exc)
        except Exception as exc:  # surfaced by the assertions below
            results[index] = ("error", exc)
        finally:
            connection.close()

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(count)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)
    return results


class PlanQuotaConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.plan = Plan.objects.create(
            code="CONCURRENCY",
            name="Concurrency Plan",
            max_users=2,
            max_products=2,
            trial_days=14,
        )
        self.shop = Shop.objects.create(
            name="Concurrency Grocery",
            address="Doha",
            phone="+97450009001",
            status=Shop.Status.ACTIVE,
        )
        self.owner = User.objects.create_user(
            shop=self.shop,
            username="concurrency_owner",
            password=PASSWORD,
            full_name="Concurrency Owner",
            role=User.Role.OWNER,
        )
        self.shop.primary_owner = self.owner
        self.shop.save(update_fields=["primary_owner", "updated_at"])
        ShopSubscription.objects.create(
            shop=self.shop,
            plan=self.plan,
            status=ShopSubscription.Status.ACTIVE,
        )

    def test_concurrent_product_creation_never_exceeds_the_plan_limit(self):
        def make_product(index):
            return create_product(
                shop=self.shop,
                validated_data={
                    "name": f"Concurrent Product {index}",
                    "sku": f"CONC-{index}",
                    "selling_price": Decimal("5.00"),
                },
            )

        results = run_concurrently(make_product, 8)
        unexpected = [r for r in results if r and r[0] == "error"]
        self.assertEqual(unexpected, [], f"unexpected errors: {unexpected}")

        active = Product.objects.filter(shop=self.shop, is_active=True).count()
        self.assertLessEqual(
            active,
            self.plan.max_products,
            f"plan cap is {self.plan.max_products} but {active} active products "
            "were created concurrently",
        )

    def test_concurrent_staff_creation_never_exceeds_the_plan_limit(self):
        # The owner already occupies one of the two seats.
        def make_user(index):
            return create_staff_user(
                actor=self.owner,
                full_name=f"Concurrent Cashier {index}",
                username=f"conc_cashier_{index}",
                temporary_password=PASSWORD,
                role=User.Role.CASHIER,
            )

        results = run_concurrently(make_user, 8)
        unexpected = [r for r in results if r and r[0] == "error"]
        self.assertEqual(unexpected, [], f"unexpected errors: {unexpected}")

        active = User.objects.filter(shop=self.shop, is_active=True).count()
        self.assertLessEqual(
            active,
            self.plan.max_users,
            f"plan cap is {self.plan.max_users} but {active} active users "
            "exist after concurrent creation",
        )
