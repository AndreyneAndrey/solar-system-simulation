from flask import Flask, render_template

# Инициализируем приложение Flask
app = Flask(__name__)

# Главная страница сайта
@app.route('/')
def index():
    # Flask автоматически ищет этот файл в папке templates
    return render_template('index.html')

if __name__ == '__main__':
    # Запускаем локальный сервер
    app.run(debug=True)
