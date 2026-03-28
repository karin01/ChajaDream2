# Python 베이스 이미지
FROM python:3.10-slim

WORKDIR /app

COPY . /app

RUN pip install --upgrade pip
RUN pip install -r requirements.txt

EXPOSE 8080

# Cloud Run은 8080 포트 사용
ENV PORT 8080

CMD exec gunicorn --bind :8080 app:app 