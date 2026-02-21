from fastapi import FastAPI  # type: ignore
from app.routers.auth import router as auth
from app.routers.bills import router as bills
from app.routers.payments import router as payments
from app.routers.facility import router as facility
from app.routers.orders import router as orders
from app.routers.payers import router as payers
from app.routers.items import router as items
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

origins = ["http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth)
app.include_router(bills)
app.include_router(payments)
app.include_router(orders)
app.include_router(payers)
app.include_router(facility)
app.include_router(items)
