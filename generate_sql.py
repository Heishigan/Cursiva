import pandas as pd
import uuid
import math
from datetime import datetime

# Read the excel file
df = pd.read_excel('Application Tracking Sheet.xlsx', header=5)

clerk_id = 'user_3GnlLhDlkrItwqQtULeDNx8rSbx'

sql_statements = []
sql_statements.append("-- Generated SQL for importing Application Tracking Sheet to Supabase")

for index, row in df.iterrows():
    company = row.get('Company')
    role = row.get('Role / Title')
    
    if pd.isna(company) or pd.isna(role):
        continue
        
    date_str = str(row.get('Date'))
    if date_str and str(date_str) != 'nan':
        # Default format from pandas is YYYY-MM-DD
        try:
            created_at = pd.to_datetime(date_str).strftime('%Y-%m-%d %H:%M:%S')
        except:
            created_at = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    else:
        created_at = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        
    status = row.get('Status')
    if pd.isna(status):
        status = 'Applied'
        
    notes = row.get('Notes / Adaptations Made')
    job_description = str(notes) if not pd.isna(notes) else ''
    
    app_id = str(uuid.uuid4())
    
    # Escape quotes
    company_esc = str(company).replace("'", "''")
    role_esc = str(role).replace("'", "''")
    status_esc = str(status).replace("'", "''")
    desc_esc = str(job_description).replace("'", "''")
    
    sql = f"INSERT INTO job_applications (id, clerk_id, company_name, role_name, job_description, status, created_at) " \
          f"VALUES ('{app_id}', '{clerk_id}', '{company_esc}', '{role_esc}', '{desc_esc}', '{status_esc}', '{created_at}');"
    sql_statements.append(sql)
    
with open('import_applications.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_statements))

print(f"Generated import_applications.sql with {len(sql_statements) - 3} records.")
