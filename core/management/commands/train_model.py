import os
import pandas as pd
import numpy as np
import lightgbm as lgb
from shapely.geometry import Point
from sqlalchemy import create_engine
import joblib
from django.core.management.base import BaseCommand
from django.conf import settings

class Command(BaseCommand):
    help = "Train LightGBM ranking model for service worker recommendations"

    def handle(self, *args, **kwargs):
        # Get DB config from Django settings
        db_settings = settings.DATABASES['default']
        user = db_settings['USER']
        password = db_settings['PASSWORD']
        host = db_settings['HOST']
        port = db_settings['PORT']
        dbname = db_settings['NAME']

        conn_str = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
        engine = create_engine(conn_str)

        # ----------------------------
        # Haversine distance function
        # ----------------------------
        def haversine_vector(lat1, lon1, lat2, lon2):
            R = 6371.0
            dlat = np.radians(lat2 - lat1)
            dlon = np.radians(lon2 - lon1)
            a = np.sin(dlat/2)**2 + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon/2)**2
            c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
            return R * c

        # ----------------------------
        # Load training data
        # ----------------------------
        df = pd.read_sql("""
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
        """, engine)

        # Fill missing values
        df["num_bookings"] = df["num_bookings"].fillna(0).astype(int)
        df["total_rating"] = df["total_rating"].fillna(0.0)
        df["charge"] = df["charge"].fillna(0)

        # ----------------------------
        # User locations
        # ----------------------------
        user_locs = pd.read_sql("""
        SELECT id,
               ST_Y(location::geometry) AS lat,
               ST_X(location::geometry) AS lon
        FROM core_authenticateduser
        WHERE location IS NOT NULL;
        """, engine)

        user_locs_dict = {row["id"]: Point(row["lon"], row["lat"]) for _, row in user_locs.iterrows()}

        # Merge user lat/lon to main df
        df = df.merge(user_locs.set_index('id'), left_on='user_id', right_index=True, how='left')
        df = df.rename(columns={'lat': 'lat_user', 'lon': 'lon_user'})

        # ----------------------------
        # Feature engineering
        # ----------------------------
        # Worker stats
        worker_stats = df.groupby('worker_id').agg(
            worker_avg_rating=('total_rating', 'mean'),
            worker_total_bookings=('num_bookings', 'sum')
        ).reset_index()
        df = df.merge(worker_stats, on='worker_id', how='left')

        # User stats
        user_stats = df.groupby('user_id').agg(
            user_avg_rating=('total_rating', 'mean')
        ).reset_index()
        df = df.merge(user_stats, on='user_id', how='left')

        # Distance feature
        df['distance_km'] = haversine_vector(df['lat_user'], df['lon_user'], df['worker_lat'], df['worker_lon'])

        # Distance bucket
        df['distance_bucket'] = pd.cut(df['distance_km'], bins=[-1,1,3,10,100], labels=[0,1,2,3]).astype(int)

        # Service match feature
        past_services = df.groupby('user_id')['service_id'].apply(set).to_dict()
        df['service_match'] = df.apply(lambda row: int(row['service_id'] in past_services.get(row['user_id'], set())), axis=1)

        # Label for ranking
        df['total_rating_int'] = df['total_rating'].round().astype(int)

        # ----------------------------
        # Train-validation split
        # ----------------------------
        FEATURE_COLS = [
            "worker_lat", "worker_lon", "charge", "num_bookings",
            "distance_km", "distance_bucket", "service_match",
            "worker_avg_rating", "worker_total_bookings", "user_avg_rating"
        ]

        from sklearn.model_selection import GroupShuffleSplit
        if df["user_id"].nunique() > 1:
            gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
            train_idx, val_idx = next(gss.split(df, groups=df["user_id"]))
            train_df = df.iloc[train_idx].reset_index(drop=True)
            val_df = df.iloc[val_idx].reset_index(drop=True)
            train_groups = train_df.groupby("user_id").size().tolist()
            val_groups = val_df.groupby("user_id").size().tolist()
        else:
            train_df = df.copy()
            val_df = df.copy()
            train_groups = [len(train_df)]
            val_groups = [len(val_df)]

        # ----------------------------
        # Prepare LightGBM datasets
        # ----------------------------
        lgb_train = lgb.Dataset(train_df[FEATURE_COLS], label=train_df['total_rating_int'], group=train_groups)
        lgb_val   = lgb.Dataset(val_df[FEATURE_COLS], label=val_df['total_rating_int'], group=val_groups, reference=lgb_train)

        # ----------------------------
        # LightGBM parameters
        # ----------------------------
        params = {
            'objective': 'lambdarank',
            'metric': 'ndcg',
            'ndcg_eval_at': [1, 3, 5],
            'boosting_type': 'gbdt',
            'learning_rate': 0.05,
            'num_leaves': 31,
            'max_depth': 6,
            'min_data_in_leaf': 50,
            'feature_fraction': 0.8,
            'bagging_fraction': 0.8,
            'bagging_freq': 5,
            'lambda_l1': 1.0,
            'lambda_l2': 1.0,
            'min_gain_to_split': 0.01,
            'verbose': -1
        }

        # ----------------------------
        # Train model
        # ----------------------------
        evals_result = {}
        model = lgb.train(
            params,
            lgb_train,
            num_boost_round=2000,
            valid_sets=[lgb_train, lgb_val],
            valid_names=['train', 'valid'],
            callbacks=[
                lgb.early_stopping(stopping_rounds=50),
                lgb.log_evaluation(period=50),
                lgb.record_evaluation(evals_result)
            ]
        )

        # ----------------------------
        # Save model
        # ----------------------------
        os.makedirs("ml_models", exist_ok=True)
        model.save_model("ml_models/lgb_ranker.txt")
        joblib.dump(FEATURE_COLS, "ml_models/feature_cols.pkl")
        self.stdout.write(self.style.SUCCESS("✅ Model trained and saved successfully!"))
