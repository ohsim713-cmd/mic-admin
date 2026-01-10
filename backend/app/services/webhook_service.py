import httpx
import os
from dotenv import load_dotenv

load_dotenv()

# Global variable for the default webhook URL from environment
DEFAULT_WEBHOOK_URL = os.getenv("WEBHOOK_URL")

async def send_to_webhook(data: dict, webhook_url: str = None) -> dict:
    """
    Sends data to the specified webhook URL or the default one from environment.
    """
    target_url = webhook_url or DEFAULT_WEBHOOK_URL
    
    if not target_url:
        return {"status": "error", "message": "No Webhook URL provided or configured."}

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(target_url, json=data)
            response.raise_for_status()
            # Try to parse JSON, if not just return text
            try:
                return {"status": "success", "webhook_response": response.json()}
            except:
                 return {"status": "success", "webhook_response": response.text}
                 
        except httpx.HTTPStatusError as e:
             return {"status": "error", "message": f"Webhook returned error: {e.response.status_code}"}
        except Exception as e:
            return {"status": "error", "message": f"Error sending to webhook: {str(e)}"}
