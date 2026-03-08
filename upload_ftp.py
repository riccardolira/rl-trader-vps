import ftplib
import os

def upload_dir(ftp, local_dir, remote_dir):
    # Try creating directory if it doesn't exist
    try:
        ftp.mkd(remote_dir)
    except:
        pass
        
    print(f"Directory {remote_dir}")
    ftp.cwd(remote_dir)
    
    for f in os.listdir(local_dir):
        local_path = os.path.join(local_dir, f)
        if os.path.isfile(local_path):
            print(f"  Uploading file {f}")
            with open(local_path, 'rb') as fp:
                ftp.storbinary(f'STOR {f}', fp)
        elif os.path.isdir(local_path):
            upload_dir(ftp, local_path, f"{remote_dir}/{f}")
            ftp.cwd(remote_dir) # Go back to current remote_dir after finishing subfolder

try:
    print("Connecting to FTP...")
    ftp = ftplib.FTP('ftp.clickandoffers.com', 'u116771474', '357691Jgt.')
    
    print("Deleting old test files...")
    try:
        ftp.delete('/domains/clickandoffers.com/public_html/index.html')
    except:
        pass

    print("Uploading dist folder...")
    upload_dir(ftp, r'c:\Users\ricca\Desktop\RL TRADER ENGENHARIA\V4_VPS\frontend\dist', '/domains/clickandoffers.com/public_html')
    
    ftp.quit()
    print("Upload Complete!")

except Exception as e:
    print(f"Error: {e}")
