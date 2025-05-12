# Using the Gemini 2.0-flash-001 Fine-tuning Dataset with Google Cloud

This document provides step-by-step instructions for fine-tuning the Gemini 2.0-flash-001 model using our JSONL training dataset.

## Prerequisites

- A Google Cloud account with access to Vertex AI
- The `gcloud` CLI tool installed and configured
- A Google Cloud Storage bucket to store your training data
- Appropriate permissions to create and manage Vertex AI tuning jobs

## Step 1: Prepare Your Training Data

The `training_data.jsonl` file in this repository is already formatted according to Google Cloud's specifications. Each line contains a complete JSON object with a user query and the desired model response.

## Step 2: Upload to Google Cloud Storage

1. Create a Google Cloud Storage bucket (if you don't already have one):

```bash
gsutil mb -l us-central1 gs://your-bucket-name
```

2. Upload the training data to your bucket:

```bash
gsutil cp training_data.jsonl gs://your-bucket-name/training_data.jsonl
```

## Step 3: Create a Supervised Tuning Job

You can create a tuning job through the Google Cloud Console or using the API.

### Console Method

1. Go to the [Vertex AI Studio](https://console.cloud.google.com/vertex-ai/generative/language/studio) page
2. Click on "Tune and Distill" in the left navigation
3. Click "Create" to start a new tuning job
4. Enter the details for your job:
   - Select Gemini 2.0-flash-001 as the base model
   - Choose "Supervised tuning" as the tuning type
   - Set your hyperparameters (see recommendations below)
   - Specify the location of your training data in GCS
   - Configure compute resources and region

### API Method

Alternatively, you can create a tuning job using the API:

```bash
PROJECT_ID="your-project-id"
TUNING_JOB_REGION="us-central1"
BUCKET_URI="gs://your-bucket-name"

curl -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "displayName": "cognivore-tuning-job",
    "supervisedTuningSpec": {
      "trainingDatasetUris": ["'${BUCKET_URI}'/training_data.jsonl"],
      "validationDatasetUris": ["'${BUCKET_URI}'/validation_data.jsonl"],
      "batchSize": 4,
      "learningRate": 1e-5,
      "epochCount": 5
    }
  }' \
  "https://${TUNING_JOB_REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${TUNING_JOB_REGION}/tuningJobs"
```

Note: This example includes both training and validation datasets to help monitor performance during training and prevent overfitting.

## Step 4: Monitor Your Tuning Job

1. From the Vertex AI Studio page, click on "Tune and Distill"
2. Find your tuning job in the list and click on it
3. Check the "Monitor" tab to see training metrics

## Step 5: Use Your Tuned Model

Once the tuning job completes, you'll have a tuned model endpoint that you can use:

```python
from vertexai.generative_models import GenerativeModel

# Get your tuned model endpoint name from the tuning job details
tuned_model_endpoint_name = "projects/<PROJECT_ID>/locations/<TUNING_JOB_REGION>/tuningJobs/<TUNING_JOB_ID>"
tuned_model = GenerativeModel(tuned_model_endpoint_name)

# Use your tuned model
response = tuned_model.generate_content("What is Mnemosyne?")
print(response.text)
```

## Recommended Hyperparameters

For this specific tuning task, we recommend the following hyperparameters:

- **Batch Size**: 4-8
- **Learning Rate**: 1e-5 to 5e-5
- **Epochs**: 3-5 

These values have been chosen to balance learning the character's style and tool usage patterns without overfitting.

## Additional Resources

- [Google Cloud Vertex AI Documentation on Supervised Tuning](https://cloud.google.com/vertex-ai/docs/generative-ai/models/supervised-tuning)
- [Gemini API Documentation](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini)
- [Best Practices for Model Tuning](https://cloud.google.com/vertex-ai/docs/generative-ai/models/tune-models)

## Troubleshooting

If you encounter issues during the tuning process:

1. Check that your JSONL file is properly formatted with one complete JSON object per line
2. Verify you have sufficient permissions for Vertex AI operations
3. Monitor the job logs for specific error messages
4. Ensure you're using a supported region for Gemini model tuning 