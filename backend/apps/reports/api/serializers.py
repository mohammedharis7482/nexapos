from rest_framework import serializers


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
