// Firebase imports
import {
    getDatabase, ref, set, get, onValue, push, child, update, remove
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

import { getStorage, ref as storageRef, listAll, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";


import { app } from './config.js';

// firebase database, auth,  
const db =getDatabase();
const playerRef = ref(db , "players");
const auth = getAuth();
const checkpointRef = ref(db, "checkpoint");
const storage = getStorage(app);

// storage test ref
const userFolderRef = storageRef(storage, 'UqQfKeRLvaUddutzhDL7cAY4Kil2/');
 //displayImagesForUser('UqQfKeRLvaUddutzhDL7cAY4Kil2');
 //console.log(storageRef);
 //console.log(storage);

// function to display images for a specific user
async function displayImagesForUser(userId) {
    // ref to the div where images will be displayed
    const imageContent = document.getElementById('image-content');
    // clear the container of previous images
    imageContent.innerHTML = '';

    //  show a loading message
    const loadingIndicator = document.createElement('p');
    loadingIndicator.textContent = 'Loading images...';
    imageContent.appendChild(loadingIndicator);

    // path to target the specific user's folder
    const userImagesRef = storageRef(storage, `${userId}/`); 

    listAll(userImagesRef)
        .then((res) => {
            // remove loading indicator
            imageContent.removeChild(loadingIndicator);

            if (res.items.length === 0) {
                //  display a message if the user has no images
                const noImagesMessage = document.createElement('p');
                noImagesMessage.textContent = 'No images found for this user.';
                imageContent.appendChild(noImagesMessage);
            } else {
                // loop through the images and display them
                res.items.forEach((itemRef) => {
                    getDownloadURL(itemRef)
                        .then((url) => {
                            // create img element
                            const img = document.createElement('img');
                            img.src = url;
                            img.style.width = '400px';
                            img.style.height = 'auto';
                            //space between images

                            img.style.margin = '10px'; //space between images

                            imageContent.appendChild(img);
                        })
                        .catch((error) => {
                            // error handling
                            console.error('Error getting download URL', error);
                            // display an error message
                            const errorMessage = document.createElement('p');
                            errorMessage.textContent = 'Error loading some images.';
                            imageContent.appendChild(errorMessage);
                        });
                });
            }
        })
        .catch((error) => {
            // handle error in listing image
            console.error('Error listing images', error);
            // clear loading indicator and display error message
            imageContent.innerHTML = ''; 
            const errorMessage = document.createElement('p');
            errorMessage.textContent = 'Failed to load images.';
            imageContent.appendChild(errorMessage);
        });
}


// event listener for player data changes
onValue(playerRef, (snapshot) => {
    if (snapshot.exists()) {
        const playerData = snapshot.val();

        // Check if the 'username' field exists in playerData
        if (playerData && playerData.username) {
            const username = playerData.username;
            const timestamp = new Date().toLocaleString(); 

            // log message
            const logMessage = `${username} has created an account (${timestamp})`;
            console.log(logMessage);

            // update the activity log
            updateActivityLog(logMessage);
        }

        console.log("Player data changed:", playerData);
        // updatePlayerTable(playerData);
    } else {
        console.log("No data available");
    }
});


// function to retrieve initial player data
getPlayerData();


// function to retrieve initial player data
function getPlayerData() {
    get(playerRef).then((snapshot) => {
        if (snapshot.exists()) {
            // update table with player data
            updatePlayerTable(snapshot.val());
        } else {
            console.log("No data available");
            // empty array to clear table
            updatePlayerTable([]); 
        }
    });
}

// function to update player data in table
function updatePlayerTable(playerData) {
    // ref to the table
    const table = document.getElementById("player-data");
    // clear existing table rows
    table.innerHTML = ""; 

    Object.keys(playerData).forEach((userId) => {
        // create and insert new row per player
        const player = playerData[userId];
        // append a new row to the table
        const row = table.insertRow(-1); 
        // store the userID in a data attribute
        row.setAttribute('data-userid', userId); 

        // player data
        row.innerHTML = `
            <td>${userId}</td>
            <td>${player.userName}</td>
            <td>${player.email}</td>
            <td>${player.dateOfBirth}</td>
            <td>${player.gender}</td>
        `;

        // add click event listener to the row
        row.addEventListener('click', function() {
             // retrieve the userID from the click 
            const clickedUserId = this.getAttribute('data-userid');

            console.log(`Row clicked for userId: ${clickedUserId}`);
            // clear the image container before displaying new images
            document.getElementById('image-content').innerHTML = '';
            // display images for the clicked user
            displayImagesForUser(clickedUserId);
        });
    });
}


// function to create new user and add player data
function createUserAndAddPlayer(email, password, userName, gender, dateOfBirth) {
    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            console.log("created user ... " + JSON.stringify(userCredential));
            console.log("user is now signed in");

            // create a new date object for timestamp
            const now = new Date();

            // format the date as DD/MM/YYYY
            const day = now.getDate().toString().padStart(2, '0');
            const month = (now.getMonth() + 1).toString().padStart(2, '0'); // getMonth() is zero-based
            const year = now.getFullYear().toString();

            // format the time as HH:MM:SS
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const seconds = now.getSeconds().toString().padStart(2, '0');

            // combine the date and time components
            const dateCreated = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

            // set player data using user UID
            const playerData = { email, userName, gender, dateOfBirth, dateCreated };
            const updates = {};
            updates['/players/' + user.uid] = playerData;

            // initialize leaderboard entry for the user
            const initialHighScore = 0; // Default starting score
            updates['/leaderboard/' + user.uid] = { userName, highScore: initialHighScore, lastUpdated: dateCreated };

            // initialize checkpoint entry for the user
            updates['/checkpoint/' + user.uid] = { userName, checkpoint1: false, checkpoint2: false, checkpoint3: false, lastUpdated: dateCreated };

            return update(ref(db), updates);
        })
        .then(() => {
            console.log("Player, Leaderboard, and Checkpoint data initialized successfully");
        })
        .catch((error) => {
            // handle errors
            const errorCode = error.code;
            const errorMessage = error.message;
            console.log(`ErrorCode: ${errorCode} -> Message: ${errorMessage}`);
            // display the error message
            displayErrorMessage(errorMessage, "signUpErrorMessage");
        });
}


// form submission for creating new player
document.getElementById("createPlayerForm").addEventListener("submit", function (e) {
    e.preventDefault();
    console.log("createPlayerForm clicked");
    const email = document.getElementById("inputEmail").value;
    const password = document.getElementById("inputPassword").value;
    const userName = document.getElementById("inputUsername").value;
    const gender = document.getElementById("inputGender").value;
    const dateOfBirth = document.getElementById("inputDOB").value;

    createUserAndAddPlayer(email, password, userName, gender, dateOfBirth);
    console.log("created user");
});

// function to format timestamp
function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
}


// display error msg in page
function displayErrorMessage(message, errorId) {
    const errorMessageContainer = document.getElementById(errorId);
    errorMessageContainer.textContent = message;
    // Show the error message container
    errorMessageContainer.style.display = "block"; 
}


document.addEventListener('DOMContentLoaded', (event) => {
});