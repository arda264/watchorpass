## Name
Watch or Pass (previously Actor Tinder)

## Description
Watch or Pass is our project for the 2nd year 1st semester course Software Development in Leiden University. In this app you will be given 30 actors out of top 1000 actors list of IMDB. To like an actor user swipes right, and to dislike an actor user swipes left. At the end of 30 swipes, user gets a movie reccomendation based on their liked/disliked actors. This process can be repeated with choosing swipe again feature after the movie reccomendation, with each session being independent of each other. 

## Required packages and changes

How to download the required packages. If you have the project files locally skip to the 4th step!

1) Make sure git is installed in your device
2) Create a folder, and initialize git in that folder using the command, git init.
3) run the command, git pull [project link](https://git.liacs.nl/butterfingers/softwaredevelopment.git) in the folder you created (The link can be found when you click blue button called "code" towards top right and click on HTTPS).

4) Open a command prompt on your device as admin, and navigate to the project folder with the project in using cd command.
5) Go to the project folder in Run in the command prompt, cd actor-tinder-app
6) Go to this site and download Node.js, [Nodejs download](https://nodejs.org/en/download)
7) Run in the command prompt, npm install expo
8) Run in the command prompt, cd backend
9) Run in the command prompt, pip install uvicorn
10) Run in the command prompt, pip install fastapi

Required changes to run the program

1) Open a command prompt, and run the command ipconfig on Windows or ifconfig on Macbook
2) Copy the ipv4 adress under the Wireless LAN adapter WiFi section
3) open the index.tsx file under in the folder actor-tinder-app\app
4) On line 8, change IP adress in the value of variable const API to your IP adress between the "http://" and ":8000"
5) Save and close the file

## How to Run

Make sure you followed the steps above and if not first install the required packages shown above.

1) Open a command prompt
2) Navigate to the folder where you pulled the project
3) Run, cd actor-tinder-app\backend
4) Run, python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
5) Open another command prompt
6) Navigate to the folder where you pulled the project, then run, cd actor-tinder-app
7) Run npx expo start -c

To run on web press "w". To get a cleaner look you can inspect the webpage and it will adjust to phone screen dimensions.  

To run on your phone install the expo go app on your appstore and scan the QR code. Note that in your first scan it might not work, close the app and scan again.
iOS Appstore [here](https://apps.apple.com/us/app/expo-go/id982107779), Google Playstore [here](https://play.google.com/store/apps/details?id=host.exp.exponent&hl=en)

## How to run unit tests

1) Open the terminal
2) Navigate to the "tests" folder
3) Make sure you have Pytest installed. If not, use the command "pip install pytest"
4) In the command line type "pytest"
5) Wait for approximately 30 sec
6) To get the coverage report install the coverage plugin (pip install pytest-cov) and type "pytest --cov=embeddings3 --cov-report=term-missing"

## Support
Please send your feedback and questions to a.cavusoglu@umail.leidenuniv.nl

## Authors
Group 33

Arda Cavusoglu, Alina Gladchenko, Ian Birdsall, Melisa Saldir, Nour Taylor, Matteo Atzori
