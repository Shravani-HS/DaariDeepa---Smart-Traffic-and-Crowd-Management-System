import tkinter as tk
from tkinter import ttk, messagebox
from PIL import Image, ImageTk
import sqlite3
import random
import joblib

model = joblib.load(r"C:\Users\sarvesh wale\OneDrive\Desktop\aicrowd\crowd_model.pkl")

# ---------------- DATABASE ----------------
conn = sqlite3.connect("dwarkadhish.db")
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS user_registration (
    aadhar_id TEXT PRIMARY KEY,
    full_name TEXT,
    mobile_no TEXT,
    email_id TEXT,
    registration_date TEXT
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS booking_details (
    booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
    aadhar_id TEXT,
    darshan_date TEXT,
    time_slot TEXT,
    total_ppl INTEGER,
    has_special_needs TEXT,
    needs_assistance TEXT
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS reported_issues (
    issue_id INTEGER PRIMARY KEY AUTOINCREMENT,
    aadhar_id TEXT,
    issue_type TEXT,
    description TEXT,
    reported_on TEXT
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS emergencies_reported (
    emergency_id INTEGER PRIMARY KEY AUTOINCREMENT,
    aadhar_id TEXT,
    emergency_type TEXT,
    details TEXT,
    reported_on TEXT
)
""")

conn.commit()

# ---------------- MAIN WINDOW ----------------
root = tk.Tk()
root.title("Temple Admin Dashboard")
root.geometry("900x600")
root.withdraw()

# ---------------- BACKGROUND ----------------
original_bg = Image.open("image.webp")

canvas = tk.Canvas(root, highlightthickness=0)
canvas.pack(fill="both", expand=True)

def resize_bg(event):
    resized = original_bg.resize((event.width, event.height))
    bg = ImageTk.PhotoImage(resized)
    canvas.delete("bg")
    canvas.create_image(0, 0, image=bg, anchor="nw", tags="bg")
    canvas.bg = bg

root.bind("<Configure>", resize_bg)

# ---------------- LOGIN ----------------
ADMIN_PASSWORD = "admin123"

def show_login():
    login_win = tk.Toplevel()
    login_win.title("Admin Login")
    login_win.geometry("300x200")

    tk.Label(login_win, text="Enter Password").pack(pady=20)

    password_entry = tk.Entry(login_win, show="*")
    password_entry.pack()

    def check():
        if password_entry.get() == ADMIN_PASSWORD:
            login_win.destroy()
            root.deiconify()
        else:
            messagebox.showerror("Error", "Wrong Password")

    tk.Button(login_win, text="Login", command=check).pack(pady=10)

show_login()

# ---------------- TABLE VIEW ----------------
def show_table(title, query, columns):
    win = tk.Toplevel(root)
    win.title(title)
    win.geometry("900x500")

    tree = ttk.Treeview(win, columns=columns, show='headings')
    for col in columns:
        tree.heading(col, text=col)
        tree.column(col, width=120)

    tree.pack(fill='both', expand=True)

    cursor.execute(query)
    for row in cursor.fetchall():
        tree.insert("", tk.END, values=row)

# ---------------- CROWD SYSTEM ----------------
current_crowd = 250
alert_triggered = False

def show_crowd():
    win = tk.Toplevel(root)
    win.title("Live Crowd Count")
    win.geometry("350x300")

    MAX_CAPACITY = 800

    label = tk.Label(win, font=("Helvetica", 18))
    label.pack(pady=15)

    status_label = tk.Label(win, font=("Helvetica", 14, "bold"))
    status_label.pack(pady=5)

    progress = ttk.Progressbar(win, length=250, mode='determinate')
    progress.pack(pady=10)

    style = ttk.Style()
    style.configure("green.Horizontal.TProgressbar", background='green')
    style.configure("orange.Horizontal.TProgressbar", background='orange')
    style.configure("red.Horizontal.TProgressbar", background='red')

    def update():
        global current_crowd, alert_triggered

        entries = random.randint(0, 10)
        exits = random.randint(0, 8)

        current_crowd += entries - exits
        current_crowd = max(50, min(MAX_CAPACITY, current_crowd))

        percent = int((current_crowd / MAX_CAPACITY) * 100)

        label.config(text=f"Crowd: {current_crowd} / {MAX_CAPACITY}\n({percent}% full)")
        progress['value'] = percent

        if current_crowd < 300:
            status_label.config(text="🟢 NORMAL", fg="green")
            progress.configure(style="green.Horizontal.TProgressbar")
            alert_triggered = False

        elif current_crowd <= 600:
            status_label.config(text="🟡 MODERATE", fg="orange")
            progress.configure(style="orange.Horizontal.TProgressbar")
            alert_triggered = False

        else:
            status_label.config(text="🔴 OVERCROWDED", fg="red")
            progress.configure(style="red.Horizontal.TProgressbar")

            if not alert_triggered:
                messagebox.showwarning("Alert", "Temple is overcrowded!")
                alert_triggered = True

        win.after(2000, update)

    update()

# ---------------- RFID + HEATMAP ----------------
def show_rfid_map():
    win = tk.Toplevel(root)
    win.title("RFID + Heatmap")
    win.geometry("600x400")

    canvas_map = tk.Canvas(win)
    canvas_map.pack(fill="both", expand=True)

    map_img = Image.open("map.jpg").resize((600, 400))
    map_photo = ImageTk.PhotoImage(map_img)

    canvas_map.create_image(0, 0, image=map_photo, anchor="nw")
    canvas_map.image = map_photo

    dots = [[random.randint(50, 550), random.randint(50, 350)] for _ in range(80)]

    def update():
        canvas_map.delete("dot")
        canvas_map.delete("heat")

        heat = {}

        for dot in dots:
            dx = random.randint(-8, 8)
            dy = random.randint(-8, 8)

            dot[0] = max(0, min(600, dot[0] + dx))
            dot[1] = max(0, min(400, dot[1] + dy))

            zone = (dot[0]//100, dot[1]//100)
            heat[zone] = heat.get(zone, 0) + 1

        # ✅ FIXED PART (only change)
        for (zx, zy), count in heat.items():
            color = None

            if count > 10:
                color = "red"
            elif count > 6:
                color = "orange"
            elif count > 3:
                color = "yellow"

            if color:
                canvas_map.create_rectangle(
                    zx*100, zy*100,
                    zx*100+100, zy*100+100,
                    fill=color, stipple="gray25",
                    tags="heat"
                )

        for dot in dots:
            canvas_map.create_oval(
                dot[0], dot[1],
                dot[0]+10, dot[1]+10,
                fill="red", tags="dot"
            )

        win.after(4000, update)

    update()



#----------------- PKL -----------------
def show_prediction():
    import matplotlib.pyplot as plt

    win = tk.Toplevel(root)
    win.title("Predicted Crowd (2025)")
    win.geometry("600x500")

    tree = ttk.Treeview(win, columns=("Month", "Predicted Crowd"), show='headings')

    tree.heading("Month", text="Month")
    tree.heading("Predicted Crowd", text="Predicted Crowd")

    tree.pack(fill='both', expand=True)

    festival_months = {3:1, 9:1, 10:1, 11:1}

    month_names = ["Jan","Feb","Mar","Apr","May","Jun",
                   "Jul","Aug","Sep","Oct","Nov","Dec"]

    predictions_list = []

    for i, m in enumerate(range(1, 13)):
        festival = festival_months.get(m, 0)
        pred = model.predict([[m, festival, 2025]])[0]

        predictions_list.append(int(pred))

        tree.insert("", tk.END, values=(month_names[i], int(pred)))

    # 🔥 GRAPH BUTTON
    def show_graph():
        plt.figure()
        plt.plot(month_names, predictions_list, marker='o')
        plt.title("Predicted Crowd Trend (2025)")
        plt.xlabel("Month")
        plt.ylabel("Crowd Count")
        plt.grid()

        plt.show()

    graph_btn = tk.Button(win, text="📊 Show Graph", command=show_graph)
    graph_btn.pack(pady=10)
# ---------------- BUTTONS ----------------
def create_button(text, y, command):
    btn = tk.Button(root, text=text, width=30, font=("Helvetica", 12), command=command)
    canvas.create_window(450, y, window=btn)

title = tk.Label(root, text="Temple Admin Panel", font=("Helvetica", 20, "bold"), bg="white")
canvas.create_window(450, 60, window=title)

create_button("📋 View Booked Users", 140, lambda: show_table(
    "Bookings", "SELECT * FROM booking_details",
    ["ID","Aadhar","Date","Slot","People","Special","Assist"]
))

create_button("🧍 View Registered Users", 200, lambda: show_table(
    "Users", "SELECT * FROM user_registration",
    ["Aadhar","Name","Mobile","Email","Date"]
))

create_button("⚠️ Reported Issues", 260, lambda: show_table(
    "Issues", "SELECT * FROM reported_issues",
    ["ID","Aadhar","Type","Desc","Date"]
))

create_button("🚨 Emergencies", 320, lambda: show_table(
    "Emergencies", "SELECT * FROM emergencies_reported",
    ["ID","Aadhar","Type","Details","Date"]
))

create_button("📊 IOT Live Crowd", 380, show_crowd)
create_button("📍 RFID + Heatmap", 440, show_rfid_map)

create_button("📈 Predict Crowd", 500, show_prediction)

# ---------------- RUN ----------------
root.mainloop()
