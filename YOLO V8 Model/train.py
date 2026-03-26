from ultralytics import YOLO
import cv2

# Load your trained model
model = YOLO(r"C:\Users\Seenu\Downloads\TMS\runs\detect\train2\weights\best.pt")

# Load image
image_path = r"C:\Users\Seenu\Downloads\TMS\testimage1.jpeg"
img = cv2.imread(image_path)

# Run detection
results = model(img)

# Show results
for r in results:
    print("Detected objects:", len(r.boxes))

    # Draw boxes
    annotated = r.plot()

# Display image
cv2.imshow("Result", annotated)
cv2.waitKey(0)
cv2.destroyAllWindows()