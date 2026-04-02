from __future__ import annotations

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class UploadRequest(BaseModel):
    user_id: str | None = None
    filename: str = Field(min_length=1)


class CreateOrderRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    user_id: str | None = Field(default=None, validation_alias=AliasChoices("user_id", "userId"))
    style_code: str = Field(default="hollywood", min_length=1, validation_alias=AliasChoices("style_code", "styleCode"))
    source_key: str = Field(min_length=1, validation_alias=AliasChoices("source_key", "sourceKey"))
    model_id: str | None = Field(default=None, validation_alias=AliasChoices("model_id", "modelId"))
    prompt: str | None = None
    aspect_ratio: str = Field(default="1:1", min_length=3, validation_alias=AliasChoices("aspect_ratio", "aspectRatio"))


class StartOrderRequest(BaseModel):
    user_id: str | None = None


class GenerateRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    user_id: str | None = Field(default=None, validation_alias=AliasChoices("user_id", "userId"))
    source_key: str = Field(min_length=1, validation_alias=AliasChoices("source_key", "sourceKey"))
    model_id: str = Field(min_length=1, validation_alias=AliasChoices("model_id", "modelId"))
    style_code: str = Field(default="hollywood", min_length=1, validation_alias=AliasChoices("style_code", "styleCode"))
    prompt: str | None = None
    aspect_ratio: str = Field(default="1:1", min_length=3, validation_alias=AliasChoices("aspect_ratio", "aspectRatio"))


class PurchaseRequest(BaseModel):
    user_id: str | None = None
    package_code: str = Field(min_length=1)
    provider: str = Field(default="telegram", min_length=1)


class WebhookRequest(BaseModel):
    event_id: str = Field(min_length=1)
    payload: dict
