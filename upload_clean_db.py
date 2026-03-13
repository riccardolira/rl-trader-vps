import ftplib

try:
    print("Connecting to FTP...")
    ftp = ftplib.FTP('ftp.clickandoffers.com', 'u116771474', '357691Jgt.')
    
    print("Uploading clean_db.php...")
    with open(r'c:\Users\ricca\Desktop\RL TRADER ENGENHARIA\V4_VPS\clean_db.php', 'rb') as fp:
        ftp.cwd('/domains/clickandoffers.com/public_html')
        ftp.storbinary('STOR clean_db.php', fp)
        
    ftp.quit()
    print("Upload Complete!")

except Exception as e:
    print(f"Error: {e}")
