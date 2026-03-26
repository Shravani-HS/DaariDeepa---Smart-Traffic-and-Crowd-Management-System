import pandas as pd
import os
from sklearn.linear_model import LinearRegression
import joblib

# ---------------- FOLDER PATH ----------------
folder_path = r"C:\Users\sarvesh wale\OneDrive\Desktop\aicrowd\crowd"

# ---------------- LOAD FILES ----------------
all_files = [f for f in os.listdir(folder_path) if f.endswith(".csv")]

df_list = []

for file in all_files:
    file_path = os.path.join(folder_path, file)
    df = pd.read_csv(file_path)
    df_list.append(df)

data = pd.concat(df_list, ignore_index=True)

# ---------------- CLEAN COLUMN NAMES ----------------
data.columns = data.columns.str.strip()

# ❗ REMOVE DUPLICATE COLUMNS
data = data.loc[:, ~data.columns.duplicated()]

# ---------------- FIX COLUMN NAMES ----------------
# Find correct crowd column automatically
for col in data.columns:
    if "crowd" in col.lower():
        data = data.rename(columns={col: "Crowd_Count"})
        break

# ---------------- KEEP ONLY REQUIRED ----------------
data = data[['Year', 'Month', 'Crowd_Count']]

# ---------------- FIX MONTH ----------------
month_map = {
    'Jan':1, 'Feb':2, 'Mar':3, 'Apr':4,
    'May':5, 'Jun':6, 'Jul':7, 'Aug':8,
    'Sep':9, 'Oct':10, 'Nov':11, 'Dec':12
}

data['Month'] = data['Month'].map(month_map)

# ---------------- CLEAN DATA ----------------
data['Crowd_Count'] = pd.to_numeric(data['Crowd_Count'], errors='coerce')

data = data.dropna()

# convert types
data['Year'] = data['Year'].astype(int)
data['Month'] = data['Month'].astype(int)

# ---------------- FESTIVAL FEATURE ----------------
festival_months = {3:1, 9:1, 10:1, 11:1}
data['festival'] = data['Month'].map(lambda x: festival_months.get(x, 0))

# ---------------- DEBUG ----------------
print("✅ Cleaned Data Shape:", data.shape)
print(data.head())

if data.shape[0] == 0:
    print("❌ ERROR: No valid data left!")
    exit()

# ---------------- TRAIN ----------------
X = data[['Month', 'festival', 'Year']]
y = data['Crowd_Count']

model = LinearRegression()
model.fit(X, y)

print("\n✅ Model trained successfully!\n")

# ---------------- PREDICT ----------------
future = pd.DataFrame({
    'Month': range(1, 13),
    'festival': [festival_months.get(m, 0) for m in range(1, 13)],
    'Year': [2025]*12
})

predictions = model.predict(future)

print("📊 Predicted Crowd for 2026:\n")

for m, p in zip(future['Month'], predictions):
    print(f"Month {m} → {int(p)} people")

# ---------------- SAVE ----------------
joblib.dump(model, "crowd_model.pkl")

print("\n💾 Model saved!")
