from pydantic import BaseModel, Field


class UploadRequest(BaseModel):
    user_id: str = Field(min_length=1)
    filename: str = Field(min_length=1)


class CreateOrderRequest(BaseModel):
    user_id: str = Field(min_length=1)
    style_code: str = Field(min_length=1)
    source_key: str = Field(min_length=1)


class StartOrderRequest(BaseModel):
    user_id: str = Field(min_length=1)


class WebhookRequest(BaseModel):
    event_id: str = Field(min_length=1)
    payload: dict
