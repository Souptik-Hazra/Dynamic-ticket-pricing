# 🧠 MCENN Neural Engine Dockerfile
FROM tensorflow/tensorflow:2.15.0

# Set working directory
WORKDIR /app

# Install system dependencies for HDF5 and Scikit-Learn
RUN apt-get update && apt-get install -y \
    libhdf5-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
# (Note: we use a direct install for speed, or you can create a requirements.txt)
RUN pip install --no-cache-dir \
    flask \
    flask-cors \
    pandas \
    scikit-learn \
    joblib \
    python-dotenv

# Copy the Neural Engine code and pre-trained artifacts
COPY app.py .
COPY unified_model.py .
COPY unified_model.h5 .
COPY unified_scaler.pkl .

# Expose the ML Inference Port
EXPOSE 5000

# Run the Neural Engine
CMD ["python", "app.py"]
