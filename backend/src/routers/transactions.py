"""
Transactions router — list transactions with cursor-based pagination.
"""
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, Query, HTTPException
from backend.src.services.mock_data import get_mock_transactions
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from sqlalchemy import select, desc, or_
# pyrefly: ignore [missing-import]
from src.core.database import get_db
# pyrefly: ignore [missing-import]
from src.dependencies import get_current_user
# pyrefly: ignore [missing-import]
from src.models import User, Transaction
# pyrefly: ignore [missing-import]
import structlog
# pyrefly: ignore [missing-import]
import base64
# pyrefly: ignore [missing-import]
import json

logger = structlog.get_logger()

router = APIRouter()


@router.get(
    "",
    response_model=dict,
    tags=["Transactions"],
    summary="List Transactions",
    description="List user's transactions with cursor-based pagination",
)
async def list_transactions(
    limit: int = Query(20, ge=1, le=100, description="Page size"),
    cursor: str = Query(None, description="Pagination cursor"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List user's transactions with cursor-based pagination.
    
    **Cursor-based pagination** ensures consistent results even as data changes.
    
    Query params:
    - **limit**: Number of items (1-100, default 20)
    - **cursor**: Pagination cursor (from previous response)
    
    Returns items in reverse chronological order (newest first).
    """
    # Decode cursor if provided
    starting_timestamp = None
    if cursor:
        try:
            cursor_data = json.loads(base64.b64decode(cursor).decode())
            starting_timestamp = cursor_data.get("timestamp")
        except Exception as e:
            logger.warning("cursor_decode_failed", error=str(e))
    
    # Query transactions where user is sender or receiver
    query = select(Transaction).where(
        or_(Transaction.sender_id == user.id, Transaction.receiver_id == user.id)
    )
    query = query.order_by(desc(Transaction.created_at))
    
    # If cursor provided, filter to items before that timestamp
    if starting_timestamp:
        from datetime import datetime, timezone
        cursor_dt = datetime.fromisoformat(starting_timestamp).replace(tzinfo=timezone.utc)
        query = query.where(Transaction.created_at < cursor_dt)
    
    # Fetch limit + 1 to determine if more results exist
    query = query.limit(limit + 1)
    
    result = await db.execute(query)
    transactions = result.scalars().all()
    
    # Check if more results exist
    has_more = len(transactions) > limit
    if has_more:
        transactions = transactions[:limit]
    
    # Generate next cursor
    next_cursor = None
    if has_more and transactions:
        last_transaction = transactions[-1]
        cursor_data = {
            "timestamp": last_transaction.created_at.isoformat(),
            "id": last_transaction.id,
        }
        next_cursor = base64.b64encode(
            json.dumps(cursor_data).encode()
        ).decode()
    
    return {
        "items": [
            {
                "id": t.id,
                "sender_id": t.sender_id,
                "receiver_id": t.receiver_id,
                "transaction_type": t.transaction_type,
                "amount": t.amount,
                "status": t.status,
                "squad_reference": t.squad_reference,
                "loan_id": t.loan_id,
                "created_at": t.created_at.isoformat(),
            }
            for t in transactions
        ],
        "total": len(transactions),
        "cursor": next_cursor,
        "has_more": has_more,
    }


@router.get(
    "/{transaction_id}",
    response_model=dict,
    tags=["Transactions"],
    summary="Get Transaction",
    description="Get transaction details",
)
async def get_transaction(
    transaction_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get specific transaction details.
    
    - **transaction_id**: Transaction ID
    """
    query = select(Transaction).where(
        Transaction.id == transaction_id,
        or_(Transaction.sender_id == user.id, Transaction.receiver_id == user.id)
    )
    result = await db.execute(query)
    transaction = result.scalar_one_or_none()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    return {
        "id": transaction.id,
        "sender_id": transaction.sender_id,
        "receiver_id": transaction.receiver_id,
        "transaction_type": transaction.transaction_type,
        "amount": transaction.amount,
        "status": transaction.status,
        "squad_reference": transaction.squad_reference,
        "loan_id": transaction.loan_id,
        "metadata": transaction.tx_metadata,
        "created_at": transaction.created_at.isoformat(),
        "updated_at": transaction.updated_at.isoformat(),
    }

@router.get("/mock-data")
async def read_mock_transactions():
    return get_mock_transactions()