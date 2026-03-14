import os
import logging
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

logger = logging.getLogger(__name__)


class EmailServiceError(Exception):
    pass


def send_contact_notification(
    recipient_email: str,
    contact_name: str,
    contact_email: str,
    contact_phone: str,
    contact_company: str,
    contact_message: str,
    language: str = "de"
) -> bool:
    """
    Send email notification when contact form is submitted.
    
    Args:
        recipient_email: Email to send notification to (info@feelathomenow.ch)
        contact_name: Name of the person who submitted the form
        contact_email: Email of the person who submitted the form
        contact_phone: Phone number of the person
        contact_company: Company name (optional)
        contact_message: Message content
        language: Language preference (de/en)
    
    Returns:
        bool: True if email was sent successfully
    """
    sendgrid_api_key = os.environ.get("SENDGRID_API_KEY")
    sender_email = os.environ.get("SENDER_EMAIL", "noreply@feelathomenow.ch")
    
    if not sendgrid_api_key:
        logger.error("SENDGRID_API_KEY not configured")
        raise EmailServiceError("Email service not configured")
    
    # Create subject based on language
    if language == "de":
        subject = f"Neue Kontaktanfrage von {contact_name}"
        company_label = "Unternehmen"
        phone_label = "Telefon"
        message_label = "Nachricht"
        footer_text = "Diese E-Mail wurde automatisch vom FeelAtHomeNow Kontaktformular gesendet."
    else:
        subject = f"New Contact Inquiry from {contact_name}"
        company_label = "Company"
        phone_label = "Phone"
        message_label = "Message"
        footer_text = "This email was automatically sent from the FeelAtHomeNow contact form."
    
    # Build HTML email content
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{
                font-family: 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #2C3E50;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }}
            .header {{
                background: linear-gradient(135deg, #FF7A3D 0%, #FF6A2D 100%);
                padding: 30px;
                border-radius: 8px 8px 0 0;
                text-align: center;
            }}
            .header h1 {{
                color: white;
                margin: 0;
                font-size: 24px;
            }}
            .content {{
                background: #ffffff;
                padding: 30px;
                border: 1px solid #e0e0e0;
                border-top: none;
                border-radius: 0 0 8px 8px;
            }}
            .field {{
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 1px solid #f0f0f0;
            }}
            .field:last-child {{
                border-bottom: none;
                margin-bottom: 0;
            }}
            .label {{
                font-size: 12px;
                text-transform: uppercase;
                color: #888;
                letter-spacing: 0.5px;
                margin-bottom: 5px;
            }}
            .value {{
                font-size: 16px;
                color: #2C3E50;
            }}
            .message-box {{
                background: #f8f9fa;
                padding: 20px;
                border-radius: 6px;
                border-left: 4px solid #FF7A3D;
            }}
            .footer {{
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid #e0e0e0;
                font-size: 12px;
                color: #888;
                text-align: center;
            }}
            a {{
                color: #FF7A3D;
                text-decoration: none;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>FeelAtHomeNow</h1>
        </div>
        <div class="content">
            <div class="field">
                <div class="label">Name</div>
                <div class="value">{contact_name}</div>
            </div>
            <div class="field">
                <div class="label">Email</div>
                <div class="value"><a href="mailto:{contact_email}">{contact_email}</a></div>
            </div>
            <div class="field">
                <div class="label">{phone_label}</div>
                <div class="value"><a href="tel:{contact_phone}">{contact_phone}</a></div>
            </div>
            {"<div class='field'><div class='label'>" + company_label + "</div><div class='value'>" + contact_company + "</div></div>" if contact_company else ""}
            <div class="field">
                <div class="label">{message_label}</div>
                <div class="message-box">
                    {contact_message.replace(chr(10), '<br>')}
                </div>
            </div>
            <div class="footer">
                {footer_text}
            </div>
        </div>
    </body>
    </html>
    """
    
    message = Mail(
        from_email=Email(sender_email, "FeelAtHomeNow"),
        to_emails=To(recipient_email),
        subject=subject,
        html_content=Content("text/html", html_content)
    )
    
    try:
        sg = SendGridAPIClient(sendgrid_api_key)
        response = sg.send(message)
        
        if response.status_code in [200, 201, 202]:
            logger.info(f"Email sent successfully to {recipient_email}")
            return True
        else:
            logger.error(f"SendGrid returned status {response.status_code}")
            raise EmailServiceError(f"Email sending failed with status {response.status_code}")
            
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        raise EmailServiceError(f"Failed to send email: {str(e)}")
