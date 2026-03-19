from app.adapters.mock_provider import MockPhotoProvider


class FluxAdapter(MockPhotoProvider):
    def __init__(self) -> None:
        super().__init__(provider_id="flux")
