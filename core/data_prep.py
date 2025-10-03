# backend/core/data_prep.py
import pandas as pd

FEATURE_COLS = [
    "worker_lat", "worker_lon", "charge", "num_bookings",
    "distance_km", "distance_bucket", "service_match",
    "worker_avg_rating", "worker_total_bookings", "user_avg_rating"
]

def load_df(engine):
    query = """
    SELECT 
        user_id,
        worker_id,
        service_id,
        ST_Y(worker_location::geometry) AS worker_lat,
        ST_X(worker_location::geometry) AS worker_lon,
        charge,
        num_bookings,
        total_rating
    FROM user_worker_data;
    """
    df = pd.read_sql(query, engine)
    
    # Fill missing values as needed
    df["num_bookings"] = df["num_bookings"].fillna(0).astype(int)
    df["total_rating"] = df["total_rating"].fillna(0.0)
    df["charge"] = df["charge"].fillna(0)
    
    return df

def worker_stats(df):
    return df.groupby('worker_id').agg(
        worker_avg_rating=('total_rating', 'mean'),
        worker_total_bookings=('num_bookings', 'sum')
    ).reset_index()


def user_stats(df):
    return df.groupby('user_id').agg(
        user_avg_rating=('total_rating', 'mean')
    ).reset_index()
