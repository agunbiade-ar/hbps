def get_order_type(raw_order_type: str):
    raw_order_type = (raw_order_type or "").lower().strip()

    if raw_order_type.startswith("drug"):
        return "drug"
    elif raw_order_type.startswith("test"):
        return "lab"
    elif raw_order_type.startswith("procedure"):
        return "procedure"
    else:
        return None
