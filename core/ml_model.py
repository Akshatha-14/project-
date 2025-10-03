import lightgbm as lgb
import os

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../ml_models/lgb_ranker.txt")

def load_model():
    return lgb.Booster(model_file=MODEL_PATH)

# Load model once when this module is imported
recommendation_model = load_model()
