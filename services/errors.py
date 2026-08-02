class ServiceError(Exception):
    """Erro esperado de um caso de uso, independente do protocolo HTTP."""


class ValidationError(ServiceError):
    pass


class NotFoundError(ServiceError):
    pass


class ConflictError(ServiceError):
    pass


class PersistenceError(ServiceError):
    pass
