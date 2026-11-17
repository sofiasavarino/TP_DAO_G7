from pydantic import BaseModel, ConfigDict


class AutorDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str


class AutorCreate(BaseModel):
    nombre: str
