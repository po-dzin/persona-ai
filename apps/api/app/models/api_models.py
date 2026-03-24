from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class UploadRequest(BaseModel):
    user_id: str | None = None
    filename: str = Field(min_length=1)


class CreateOrderRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    user_id: str | None = None
    style_code: str = Field(min_length=1)
    source_key: str = Field(min_length=1)
    model_id: str | None = None
    prompt: str | None = None
    aspect_ratio: str = Field(default="1:1", min_length=3)


class StartOrderRequest(BaseModel):
    user_id: str | None = None


class GenerateRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    user_id: str | None = None
    source_key: str = Field(min_length=1)
    model_id: str = Field(min_length=1)
    style_code: str = Field(default="hollywood", min_length=1)
    prompt: str | None = None
    aspect_ratio: str = Field(default="1:1", min_length=3)


class PurchaseRequest(BaseModel):
    user_id: str | None = None
    package_code: str = Field(min_length=1)
    provider: str = Field(default="telegram", min_length=1)


class WebhookRequest(BaseModel):
    event_id: str = Field(min_length=1)
    payload: dict
