"""
Celery configuration for background jobs.
3 queues: critical (timeout=30s), default (timeout=300s), low (timeout=3600s).
"""
from celery import Celery
from kombu import Exchange, Queue
from src.config import settings
import structlog

logger = structlog.get_logger()

# Create Celery instance (broker/backend: DB index in URL path, not ?db=)
celery_app = Celery(
    "zovu",
    broker=settings.celery_broker_url_resolved,
    backend=settings.celery_result_backend_resolved,
)
# Force broker/backend from app settings (overrides process env like CELERY_BROKER_URL from .env)
celery_app.conf.broker_url = settings.celery_broker_url_resolved
celery_app.conf.result_backend = settings.celery_result_backend_resolved

# Task config
celery_app.conf.task_serializer = "json"
celery_app.conf.accept_content = ["json"]
celery_app.conf.result_serializer = "json"
celery_app.conf.timezone = "UTC"
celery_app.conf.enable_utc = True

# Task tracking
celery_app.conf.task_track_started = True

# Define queues
CRITICAL_QUEUE = Queue(
    "critical",
    exchange=Exchange("critical", type="direct"),
    routing_key="critical",
    queue_arguments={
        "x-max-priority": 10,
    },
)

DEFAULT_QUEUE = Queue(
    "default",
    exchange=Exchange("default", type="direct"),
    routing_key="default",
)

LOW_QUEUE = Queue(
    "low",
    exchange=Exchange("low", type="direct"),
    routing_key="low",
)

celery_app.conf.task_queues = (CRITICAL_QUEUE, DEFAULT_QUEUE, LOW_QUEUE)
celery_app.conf.task_default_queue = "default"
celery_app.conf.task_default_exchange = "default"
celery_app.conf.task_default_routing_key = "default"

# Queue-specific retry/timeout config
celery_app.autodiscover_tasks([
    "src.workers.credit_tasks",
    "src.workers.squad_tasks",
    "src.workers.job_tasks",
    "src.workers.fraud_tasks",
    "src.workers.embedding_tasks",
])
celery_app.conf.task_routes = {
    "src.workers.squad_tasks.*": {"queue": "critical", "priority": 10},
    "src.workers.job_tasks.process_gig_payout": {"queue": "critical", "priority": 9},
    "src.workers.job_tasks.notify_matching_seekers": {"queue": "default", "priority": 5},
    "src.workers.job_tasks.check_job_confirmation_deadline": {"queue": "default", "priority": 6},
    "src.workers.credit_tasks.*": {"queue": "default", "priority": 5},
    "src.workers.credit_tasks.update_activity_feed_cache": {"queue": "low", "priority": 1},
    "src.workers.embedding_tasks.*": {"queue": "low", "priority": 1},
    "src.workers.fraud_tasks.*": {"queue": "default", "priority": 7},
}

# Retry config per queue
celery_app.conf.task_default_max_retries = 3
celery_app.conf.task_default_retry_delay = 60

# Task-specific config
celery_app.conf.task_soft_time_limit = 300  # 5 minutes soft
celery_app.conf.task_time_limit = 600  # 10 minutes hard


@celery_app.task(
    bind=True,
    max_retries=2,
    time_limit=30,
    soft_time_limit=20,
    queue="critical",
    acks_late=True,
)
def example_critical_task(self, data):
    """Example critical task with strict timeout."""
    logger.info("critical_task_executed", data=data)
    return {"status": "done"}


@celery_app.task(
    bind=True,
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    queue="default",
)
def example_default_task(self, data):
    """Example default task with exponential backoff."""
    logger.info("default_task_executed", data=data)
    return {"status": "done"}


@celery_app.task(
    bind=True,
    max_retries=5,
    autoretry_for=(Exception,),
    retry_backoff=True,
    queue="low",
)
def example_low_priority_task(self, data):
    """Example low priority task."""
    logger.info("low_priority_task_executed", data=data)
    return {"status": "done"}


# Error handlers
@celery_app.task
def handle_task_error(request, exc, traceback):
    """Global error handler for failed tasks."""
    logger.error(
        "celery_task_failed",
        task_id=request.id,
        task_name=request.task,
        error=str(exc),
        exc_info=True,
    )
