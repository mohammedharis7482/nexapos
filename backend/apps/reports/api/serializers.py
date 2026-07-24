from rest_framework import serializers


class ReportFilterSerializer(serializers.Serializer):
    date_from = serializers.DateField()
    date_to = serializers.DateField()
    cashier = serializers.UUIDField(required=False)
    category = serializers.UUIDField(required=False)
    payment_method = serializers.ChoiceField(
        choices=["CASH", "CARD"],
        required=False,
    )

    def validate(self, attrs):
        if attrs["date_from"] > attrs["date_to"]:
            raise serializers.ValidationError(
                {"date_to": "End date must be on or after start date."}
            )
        if (attrs["date_to"] - attrs["date_from"]).days > 366:
            raise serializers.ValidationError(
                {"date_to": "Report ranges cannot exceed 367 calendar days."}
            )
        return attrs


class RecentSaleSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    sale_number = serializers.CharField()
    completed_at = serializers.DateTimeField()
    cashier_name = serializers.CharField()
    item_count = serializers.IntegerField()
    payment_methods = serializers.ListField(child=serializers.CharField())
    grand_total = serializers.DecimalField(max_digits=14, decimal_places=2)


class InventoryAlertSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()
    product_name = serializers.CharField()
    sku = serializers.CharField()
    category = serializers.CharField(allow_null=True)
    unit = serializers.CharField()
    quantity_on_hand = serializers.DecimalField(
        max_digits=15, decimal_places=3, allow_null=True
    )
    low_stock_threshold = serializers.DecimalField(
        max_digits=15, decimal_places=3, allow_null=True
    )
    stock_status = serializers.CharField()


class InventoryAlertsSerializer(serializers.Serializer):
    low_stock = InventoryAlertSerializer(many=True)
    out_of_stock = InventoryAlertSerializer(many=True)
    not_initialized = InventoryAlertSerializer(many=True)


class TopProductSerializer(serializers.Serializer):
    rank = serializers.IntegerField()
    product_id = serializers.UUIDField()
    product_name = serializers.CharField()
    sku = serializers.CharField()
    quantity_sold = serializers.DecimalField(max_digits=15, decimal_places=3)
    sales_total = serializers.DecimalField(max_digits=14, decimal_places=2)


class SalesTrendPointSerializer(serializers.Serializer):
    date = serializers.DateField()
    sales_total = serializers.DecimalField(max_digits=14, decimal_places=2)
    completed_sales_count = serializers.IntegerField()


class PaymentBreakdownItemSerializer(serializers.Serializer):
    method = serializers.CharField()
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    percentage = serializers.DecimalField(max_digits=5, decimal_places=2)


class DashboardSummarySerializer(serializers.Serializer):
    sales_total_today = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    completed_sales_count_today = serializers.IntegerField(required=False)
    average_sale_value_today = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    items_sold_today = serializers.DecimalField(max_digits=15, decimal_places=3, required=False)
    cash_sales_total_today = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    card_sales_total_today = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    split_sales_total_today = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    low_stock_count = serializers.IntegerField(required=False)
    out_of_stock_count = serializers.IntegerField(required=False)
    inventory_not_initialized_count = serializers.IntegerField(required=False)
    active_product_count = serializers.IntegerField(required=False)
    my_sales_total_today = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    my_completed_sales_count_today = serializers.IntegerField(required=False)
    my_average_sale_value_today = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    my_items_sold_today = serializers.DecimalField(max_digits=15, decimal_places=3, required=False)


class DashboardResponseSerializer(serializers.Serializer):
    role = serializers.CharField()
    currency = serializers.CharField()
    timezone = serializers.CharField()
    generated_at = serializers.DateTimeField()
    top_products_period = serializers.CharField()
    summary = DashboardSummarySerializer()
    recent_sales = RecentSaleSerializer(many=True)
    inventory_alerts = InventoryAlertsSerializer()
    top_products = TopProductSerializer(many=True)
    sales_trend = SalesTrendPointSerializer(many=True)
    payment_breakdown = PaymentBreakdownItemSerializer(many=True)


class DashboardEnvelopeSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    message = serializers.CharField()
    data = DashboardResponseSerializer()


class ReportDailyPointSerializer(serializers.Serializer):
    date = serializers.DateField()
    sales_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    sales_count = serializers.IntegerField()


class SalesReportSerializer(serializers.Serializer):
    gross_sales = serializers.DecimalField(max_digits=16, decimal_places=2)
    completed_sales_count = serializers.IntegerField()
    average_sale_value = serializers.DecimalField(max_digits=16, decimal_places=2)
    items_sold = serializers.DecimalField(max_digits=18, decimal_places=3)
    tax_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    discount_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    daily = ReportDailyPointSerializer(many=True)


class ProductReportRowSerializer(serializers.Serializer):
    rank = serializers.IntegerField()
    product_id = serializers.UUIDField()
    product_name = serializers.CharField()
    sku = serializers.CharField()
    unit = serializers.CharField()
    quantity_sold = serializers.DecimalField(max_digits=18, decimal_places=3)
    sales_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    sales_count = serializers.IntegerField()


class InventoryReportRowSerializer(InventoryAlertSerializer):
    pass


class InventoryReportSerializer(serializers.Serializer):
    active_products = serializers.IntegerField()
    in_stock = serializers.IntegerField()
    low_stock = serializers.IntegerField()
    out_of_stock = serializers.IntegerField()
    not_initialized = serializers.IntegerField()
    quantity_on_hand = serializers.DecimalField(max_digits=18, decimal_places=3)
    items = InventoryReportRowSerializer(many=True)


class PaymentReportRowSerializer(serializers.Serializer):
    method = serializers.CharField()
    amount = serializers.DecimalField(max_digits=16, decimal_places=2)
    payment_count = serializers.IntegerField()
    sale_count = serializers.IntegerField()
    percentage = serializers.DecimalField(max_digits=5, decimal_places=2)


class CashierReportRowSerializer(serializers.Serializer):
    cashier_id = serializers.UUIDField()
    cashier_name = serializers.CharField()
    sales_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    completed_sales_count = serializers.IntegerField()
    average_sale_value = serializers.DecimalField(max_digits=16, decimal_places=2)
    items_sold = serializers.DecimalField(max_digits=18, decimal_places=3)


class AppliedReportFiltersSerializer(serializers.Serializer):
    date_from = serializers.DateField()
    date_to = serializers.DateField()
    cashier = serializers.UUIDField(allow_null=True)
    category = serializers.UUIDField(allow_null=True)
    payment_method = serializers.CharField(allow_null=True)


class ReportsResponseSerializer(serializers.Serializer):
    currency = serializers.CharField()
    timezone = serializers.CharField()
    generated_at = serializers.DateTimeField()
    filters = AppliedReportFiltersSerializer()
    sales = SalesReportSerializer()
    products = ProductReportRowSerializer(many=True)
    inventory = InventoryReportSerializer()
    payments = PaymentReportRowSerializer(many=True)
    cashiers = CashierReportRowSerializer(many=True)


class ReportsEnvelopeSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    message = serializers.CharField()
    data = ReportsResponseSerializer()
