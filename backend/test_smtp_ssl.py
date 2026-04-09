import smtplib
from email.mime.text import MIMEText

def test_smtp_ssl():
    sender = "izadosolutions729@gmail.com"
    password = "qgiy zgkw wyvk dvii"
    receiver = "izadosolutions729@gmail.com"

    msg = MIMEText("Test SSL SMTP")
    msg["Subject"] = "SSL SMTP Test"
    msg["From"] = sender
    msg["To"] = receiver

    try:
        print("Connecting to smtp.gmail.com:465 via SSL...")
        server = smtplib.SMTP_SSL("smtp.gmail.com", 465)
        server.set_debuglevel(1)
        print("Logging in...")
        server.login(sender, password)
        print("Sending mail...")
        server.sendmail(sender, [receiver], msg.as_string())
        server.quit()
        print("Mail sent successfully using SSL!")
    except Exception as e:
        print(f"SMTP SSL Error: {e}")

if __name__ == "__main__":
    test_smtp_ssl()
