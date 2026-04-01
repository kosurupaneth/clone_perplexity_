from google import genai

client = genai.Client(api_key="AIzaSyBVijVXXC7TFjSnigZQUe1swRgtQ4i02oA")

for model in client.models.list():
    print(model.name)
