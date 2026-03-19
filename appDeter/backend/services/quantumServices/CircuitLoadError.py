import traceback as tb

class CircuitLoadError(Exception):
    def __init__(self, message, filename=None, lineno=None, colno=None, code_line=None, tb=None):
        super().__init__(message)
        self.message = message
        self.filename = filename
        self.lineno = lineno
        self.colno = colno
        self.code_line = code_line
        self.tb = tb  # texto del traceback, opcional para depurar