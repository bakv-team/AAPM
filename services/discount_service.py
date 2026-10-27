from decimal import Decimal
from services.errors import ValidationError
from utils.money import money

def apply_discounts(discounts, gross, net, quantity, payment):
    """Fixed amounts apply once per purchase; discounts stack after membership."""
    for discount in discounts:
        if not discount.ativo or gross < discount.minimo or quantity < discount.quantidade or (discount.pagamento and discount.pagamento != payment):
            raise ValidationError(f"Condições não atendidas para o desconto {discount.nome}.")
        amount = money(net * discount.valor / Decimal("100")) if discount.tipo == "percentual" else money(discount.valor)
        net = max(Decimal("0.00"), money(net - amount))
    return net
