import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'cursiva.db')

def main():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE user_profiles ADD COLUMN strict_eligibility BOOLEAN DEFAULT 1;")
        conn.commit()
        print("Successfully added strict_eligibility column.")
    except sqlite3.OperationalError as e:
        print(f"OperationalError: {e} (Column might already exist)")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
