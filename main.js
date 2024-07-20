// firebase imports
import {
    getDatabase, ref, set, get, onValue, push, child, update, remove
  } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
  
import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut
  } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
  
// firebase initialization
const db = getDatabase();
const playerRef = ref(db , "players");
const auth = getAuth();
const checkPointRef = ref(db, "checkpoint");
const leaderboardRef = ref(db, "leaderboard");

// variables for pie chart
let maleCount = 0;
let femaleCount = 0;


// line chart for users over time
const lineChartElement = document.getElementById('lineChart');
const lineChartContext = lineChartElement.getContext('2d');

// chart configuration
const lineChart = new Chart(lineChartContext, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'User Count',
            data: [],
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
        }]
    },
    options: {
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    precision: 0
                },
            }
        }
    }
});

// variable for latest users
let latestUsers = [];

// function to find the most recently created user in the player data
function findLatestUser(playerData) {
    const playersArray = Object.values(playerData);
    return playersArray.reduce((latest, player) => {
        if (!latest || new Date(player.dateCreated) > new Date(latest.dateCreated)) {
            return player;
        }
        return latest;
    }, null);
}

// event listener for changes in player database
onValue(playerRef, (snapshot) => {
    if (snapshot.exists()) {
        // retrieve player data from snapshot
        const playerData = snapshot.val();

        //loop through each player in snapshot
        for (const playerId in playerData) {

            // ensure userID is an own property of playerData 
            if (playerData.hasOwnProperty(playerId)) {
                // retrieve player details
                const player = playerData[playerId];
                const username = player.userName;
                // convert player's account creation date to timestamp
                const dateCreated = new Date(player.dateCreated).getTime(); // Use the correct timestamp field


                // THANKS CHAT GPT FOR THIS CODE
                // Define a time window to consider recent account creations (5 minutes in this case).
                const recentTimeWindow = 5 * 60 * 1000; // 5 minutes in milliseconds
                const currentTime = new Date().getTime();

                // Check if the player's account was created within the recent time window.

                if (currentTime - dateCreated <= recentTimeWindow) {
                    // log msg for recent account creation
                    const logMessage = `${username} has created an account `;
                    console.log(logMessage);
                    // update the activity log with msg and the account creation date.
                    updateActivityLog(logMessage, dateCreated); 
                }
            }
        }

        console.log("Player data changed:", playerData);
    } else {
        console.log("No data available");
    }
});



// initial retrieval of player data
getPlayerData();
fetchCheckpointData();

// function to group players based on account creation date and calculates the cumulative count of players for each date
function groupPlayersByDateCreated(playerData) {
    // object to hold the count of players grouped by date created
    const groupedPlayers = {};

    // loop through the playerData object 
    Object.values(playerData).forEach((player) => {

        // get the dateCreated property from each player
        const dateCreated = player.dateCreated;
        // get the date portion without time
        const dateWithoutTime = dateCreated.split(' ')[0];

        if (dateWithoutTime) {
            if (!groupedPlayers[dateWithoutTime]) {
                groupedPlayers[dateWithoutTime] = 0;
            }
            // increment the count for this date

            groupedPlayers[dateWithoutTime]++;
        }
    });

    // sort dates in ascending order to calculate the cumulative count correctly
    // thx chat gpt
    const datesSorted = Object.keys(groupedPlayers).sort((a, b) => {
        // Split the dates to separate the day, month, and year 
        const [dayA, monthA, yearA] = a.split('/');
        const [dayB, monthB, yearB] = b.split('/'); 
        // convert the dates to Date objects for comparing
        const dateA = new Date(`${yearA}-${monthA}-${dayA}`);
        const dateB = new Date(`${yearB}-${monthB}-${dayB}`);
        return dateA - dateB;
    });

    // variable to keep track of the cumulative count
    let cumulativeCount = 0;

    // object to hold the cumulative count of players up to each date
    const cumulativeGroupedPlayers = {};

    // calculate the cumulative count for each date and store it in cumulativeGroupedPlayers
    datesSorted.forEach(date => {
        // add the count for the current date to the cumulative count
        cumulativeCount += groupedPlayers[date];
        // store the cumulative count for the current date
        cumulativeGroupedPlayers[date] = cumulativeCount;
    });
    // return object containing the cumulative count of players up to each date
    return cumulativeGroupedPlayers;
}

// function to update line chart with the cumulative count of players over time
function updateLineChart(groupedPlayers) {

    // reset the line chart data
    lineChart.data.labels = [];
    lineChart.data.datasets[0].data = [];

    // retrieve all dates from the groupedPlayers object in correct order
    const allDates = getAllDates(groupedPlayers); 

    // variable to keep track of the cumulative count
    let lastKnownCumulativeCount = 0;
    // start with -1 to ensure the first date gets added
    let lastAddedCumulativeCount = -1; 

    // iterate over each date to get data 
    allDates.forEach((dateCreated) => {

        // get the cumulative count for the current date  
        const currentCumulativeCount = groupedPlayers[dateCreated] || lastKnownCumulativeCount;
        
        // check if the cumulative count has changed since the last added count
        if (currentCumulativeCount !== lastAddedCumulativeCount) {
            // update the line chart data with the current date and cumulative count
            lineChart.data.labels.push(dateCreated);
            lineChart.data.datasets[0].data.push(currentCumulativeCount);
            // update lastAddedCumulativeCount to the current cumulative count
            lastAddedCumulativeCount = currentCumulativeCount;
        }

        // update lastKnownCumulativeCount for the next iteration
        lastKnownCumulativeCount = currentCumulativeCount;
    });

    // update chart
    lineChart.update();
}


// get all dates and return sorted format
function getAllDates(groupedPlayers) {

    // Create a Set from the keys of the groupedPlayers object to eliminate any duplicates.
    const allDates = new Set(Object.keys(groupedPlayers));

    // Convert dates to a sortable and comparable format
    const sortedDates = Array.from(allDates).sort((a, b) => {
        const [dayA, monthA, yearA] = a.split('/');
        const [dayB, monthB, yearB] = b.split('/');
        const dateA = new Date(`${yearA}-${monthA}-${dayA}`);
        const dateB = new Date(`${yearB}-${monthB}-${dayB}`);
        // sort dates in ascending order
        return dateA - dateB;
    });

    // array to store all dates in range
    const filledDates = [];
    // Convert the first and last dates from the sortedDates array into Date objects to set the range
    let currentDate = new Date(sortedDates[0].split('/').reverse().join('-'));
    const endDate = new Date(sortedDates[sortedDates.length - 1].split('/').reverse().join('-'));

    // Loop through each date from currentDate to endDate, inclusive.
    while (currentDate <= endDate) {
        // Format the current date as 'DD/MM/YYYY' and add it to the filledDates array.        
        filledDates.push(
          `${currentDate.getDate().toString().padStart(2, '0')}/${(currentDate.getMonth() + 1).toString().padStart(2, '0')}/${currentDate.getFullYear()}`
        );
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // return the array of filled dates, which now includes every date in the range
    return filledDates;
}

// retrieve player info and put in chart
function getPlayerData() {
    get(playerRef).then((snapshot) => {
        if (snapshot.exists()) {
            
            // get player data from snapshot
            const playerData = snapshot.val();
            // calculate total number of players
            const userCount = Object.keys(playerData).length;
            console.log("Number of players:", userCount);

            // group player by creation date 
            const groupedPlayers = groupPlayersByDateCreated(playerData);
            console.log("grouped", groupedPlayers)

            // update line chart with the grouped player data
            updateLineChart(groupedPlayers);

            // iterate over each player for gender

            for (const userId in playerData) {
                const gender = playerData[userId].gender;

                if (gender === 'Male') {
                    maleCount++;
                } else if (gender === 'Female') {
                    femaleCount++;
                }
            }

            // update pie chart with gender count
            updatePieChart(maleCount, femaleCount);

        } else {
            console.log("No data available");
        }
    });
}   

// keep track of previous checkpoint data
const previousCheckPointData = {}; 


// event listener for updates in checkpoint node
onValue(checkPointRef, (snapshot) => {
    // get checkpoint data from snapshot
    const checkPointData = snapshot.val();
    console.log("checkPointData", checkPointData);

    // iterate over each player
    for (const playerId in checkPointData) {
        // Check to ensure the property belongs directly to checkPointData
        if (checkPointData.hasOwnProperty(playerId)) {
            // Extract the checkpoints for the current player.
            const playerCheckpoints = checkPointData[playerId];
            const player = checkPointData[playerId]; 

            // Extract the player's username, defaulting to "Unknown Player" if not available.
            const userName = player.userName || "Unknown Player"; 

            // iterate over each checkpoint for current player
            for (const checkpoint in playerCheckpoints) {
                const previousValue = previousCheckPointData[playerId] ? previousCheckPointData[playerId][checkpoint] : undefined;
                // get current value of checkpoint
                const currentValue = playerCheckpoints[checkpoint];

                // Check if the checkpoint was previously false and is now true
                if (previousValue === false && currentValue === true) {
                    // create log msg
                    const logMessage = `${userName} has reached ${checkpoint}`;
                    console.log(logMessage);
                    // get the current timestamp
                    const timestamp = new Date().getTime();
                    // update the activity log with the new checkpoint reached
                    updateActivityLog(logMessage, timestamp);
                }
            }
        }
    }

    // update previousCheckPointData for the next iteration
    Object.assign(previousCheckPointData, checkPointData);
});

let checkpointChart = null; 


// function to fetch checkpoint data and draw checkpoint graph
function fetchCheckpointData() {
    // ref to html div for checkpoint chart
    const checkpointChartDiv = document.getElementById('checkpointChart');

    // event listener for changes in checkpoint node
    onValue(checkPointRef, (snapshot) => {
        const checkPointData = snapshot.val();
        console.log("checkPointData", checkPointData);

        // create an object to keep track of the counts for each checkpoint        
        const checkpointCounts = {
            checkpoint1: 0,
            checkpoint2: 0,
            checkpoint3: 0,
        };

        // variable to count players who have reached all checkpoints
        let allCheckpointCount = 0;
    
        // iterate over each player
        for (const playerId in checkPointData) {
            if (checkPointData.hasOwnProperty(playerId)) {
                const playerCheckpoints = checkPointData[playerId];
                
                // bool to determine if player reach all 3 checkpoints
                let hasAllCheckpoints = true; // Assume true until proven otherwise

                // iterate over each checkpoint
                ['checkpoint1', 'checkpoint2', 'checkpoint3'].forEach(checkpoint => {
                    // check if the checkpoint is present and true for player
                    if (!playerCheckpoints.hasOwnProperty(checkpoint) || playerCheckpoints[checkpoint] !== true) {
                        hasAllCheckpoints = false; // player hasnt reached all checkpoints
                    } else {
                        // increment the count for this checkpoint
                        checkpointCounts[checkpoint]++; 
                    }
                });
    
                // if player has all checkpoints, increment the counter
                if (hasAllCheckpoints) {
                    allCheckpointCount++;
                }
            }
        }

        console.log("jaja", Object.keys(checkpointCounts));

        console.log('bing bong ', checkpointCounts);
        console.log("augh", allCheckpointCount);

        // update the html to show total number of players who have all checkpoints
        document.getElementById('playersWithAllCheckpoints').textContent = allCheckpointCount;

        const checkpointData = {
            labels: Object.keys(checkpointCounts),
            datasets: [{
                data: Object.values(checkpointCounts),
                backgroundColor: ['#28a745', '#007bff', '#ffc107'],
            }]
        };

        checkpointChartDiv.chart = new Chart(checkpointChartDiv, {
            type: 'bar',
            data: checkpointData,
            options: {
                indexAxis: 'y',
                scales: {
                    x: {
                        ticks: {
                            stepSize: 1,
                            beginAtZero: true, 

                            callback: function(value) {
                                if (value % 1 === 0) {
                                    return value;
                                }
                            }
                        }
                    }
                },
                elements: {
                    bar: {
                        borderWidth: 2,
                    }
                },
                responsive: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom', 

                    },
                    title: {
                        display: true,
                        text: 'Checkpoints'
                    }
                }
            },
            
        });
    });
}


// function to update the activity log with new highscore from leaderboard
function updateHighScoreLog(message, timeStampDate, difference) {
    // ref to html div for activity log
    const activityLogContainer = document.getElementById('activityLog');

    if (activityLogContainer) {
        // create a new list item for the log message
        const logItem = document.createElement('li');

        // span for main msg
        const messageSpan = document.createElement('span');
        // set span text to the message
        messageSpan.textContent = message;

        // create an arrow icon to indicate the difference
        const arrowIcon = document.createElement('i');
        // font awesome!!!
        arrowIcon.classList.add('fa', 'fa-arrow-up'); 
        arrowIcon.style.color = 'green';
        arrowIcon.style.marginLeft = '3px';

        // another span for score diff
        const differenceSpan = document.createElement('span');
        differenceSpan.textContent = ` ${difference}`; 

        // append the spans to create a log
        logItem.appendChild(messageSpan);
        logItem.appendChild(arrowIcon);
        logItem.appendChild(differenceSpan);

        // insert the new log item at the top of the activity log container.
        const oldestLogItem = activityLogContainer.firstChild;
        activityLogContainer.insertBefore(logItem, oldestLogItem);

        // save log to local storage
        saveLogToLocalStorage(message);
    } else {
        console.error("Activity log container not found.");
    }
}

// keep track of previous leaderboard data
const previousLeaderboardData = {}; 

// event listener for changes in leaderboard node
onValue(leaderboardRef, (snapshot) => {
    // get leaderboard data from snapshot
    const leaderboardData = snapshot.val();
    console.log("leaderboardData", leaderboardData);

    // iterate over each player in the leaderboard data.
    for (const playerId in leaderboardData) {
        if (leaderboardData.hasOwnProperty(playerId)) {

            // retrieve player object
            const player = leaderboardData[playerId];

            // retrieve the players previous high score, default to 0 if dont exist
            const previousHighScore = previousLeaderboardData[playerId] ? previousLeaderboardData[playerId].highScore : 0;

            // retrieve the player's current high score from the updated data
            const currentHighScore = player.highScore;

            // check if current high score is greater than previous high score if player has score b4
            if (currentHighScore > previousHighScore && previousHighScore !== 0) {

                // calculate difference between the current and previous high scores
                const difference = currentHighScore - previousHighScore;
                // get current timestamp
                const timestamp = new Date().getTime(); 
                // format the log message to include everything
                const logMessage = `${player.userName} achieved a new high score: ${currentHighScore} [${new Date(timestamp).toISOString()}]`;

                console.log(logMessage);
                // call function to update the high score log
                updateHighScoreLog(logMessage, timestamp, difference);
            }
        }
    }

    // update previousLeaderboardData for next iteration
    Object.assign(previousLeaderboardData, leaderboardData);
});


// function to update leaderboard on webpage
function updateLeaderboard(leaderboardData) {
    // ref to container in html
    const leaderboardContainer = document.getElementById('leaderboard');

    if (leaderboardContainer) {
        // clear before updating
        leaderboardContainer.innerHTML = '';

        // create a ribbon for 1st place
        const ribbon = document.createElement('div');
        ribbon.className = 'ribbon';
        leaderboardContainer.appendChild(ribbon);

        // create a table for the sorted entries
        const table = document.createElement('table');
        leaderboardContainer.appendChild(table);

        // sort the leaderboard data by highscore in descending order
        const sortedPlayers = Object.entries(leaderboardData)
            .sort(([, a], [, b]) => b.highScore - a.highScore)
            .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});


        // iterate over the sorted players to populate the leaderboard
        let rank = 1;
        for (const playerId in sortedPlayers) {
            if (sortedPlayers.hasOwnProperty(playerId)) {
                const player = sortedPlayers[playerId];

                // create a table row for each player with their rank name and score
                const tableRow = document.createElement('tr');  
                tableRow.innerHTML = `
                    <td class="number">${rank}</td>
                    <td class="name">${player.userName}</td>
                    <td class="points">${player.highScore}${(rank === 1) ? ' <img class="gold-medal" src="./medal.png" alt="gold medal"/>' : ''}</td>
                    `;
                // add the table row to the table.
                table.appendChild(tableRow);
                // increment rank for next player
                rank++;
            }
        }
    } else {
        console.error("Leaderboard container not found.");
    }
}

// function to fetch and display  leaderboard data from database
onValue(leaderboardRef, (snapshot) => {
    // get leaderboard data from snapshot    
    const leaderboardData = snapshot.val();
    console.log("leaderboardData", leaderboardData);

    // update the leaderboard display with new data
    updateLeaderboard(leaderboardData);
});


// event listener for authentication state changes
onAuthStateChanged(auth, (user) => {
if (user) {
    // user is signed in
    console.log("User is signed in:", user);
} else {
    // user is signed out
    console.log("User is signed out");
}
});


// initialize pie chart to display gender ratio
const ctx = document.getElementById('genderChart').getContext('2d');

const myPieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Male', 'Female'],
            datasets: [{
                data: [maleCount, femaleCount],
                backgroundColor: ['#28a745', '#007bff'],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
});


// function to update the gender ratio pie chart
function updatePieChart(maleCount, femaleCount) {
    // update the pie chart data
    myPieChart.data.datasets[0].data = [maleCount, femaleCount];
    myPieChart.options.aspectRatio = false;

    // updatte the pie chart
    myPieChart.update();
}


// function to display error message on web
function displayErrorMessage(message, errorId) {
    // get ref to html
    const errorMessageContainer = document.getElementById(errorId);
    // set error msg
    errorMessageContainer.textContent = message;
    // make it visible
    errorMessageContainer.style.display = "block"; 
}

// function to save log to local storage for persistence    
function saveLogToLocalStorage(logItemWithTimestamp) {
    // retrieve existing logs or empty 
    const storedLogs = JSON.parse(localStorage.getItem('activityLogs')) || [];
    // check if the log entry already exists to prevent duplicates
    const logExists = storedLogs.some(log => log === logItemWithTimestamp);

    if (!logExists) {
        // add the new log entry to the array of stored logs
        storedLogs.push(logItemWithTimestamp);
        // save updated array back to local storage
        localStorage.setItem('activityLogs', JSON.stringify(storedLogs));
    }
}

// function to load and display logs from local storage
function loadLogsFromLocalStorage() {
    // get ref to html div
    const activityLogContainer = document.getElementById('activityLog');

    // retrieve existing logs or empty array
    const storedLogs = JSON.parse(localStorage.getItem('activityLogs')) || [];

    // clear any existing thing
    activityLogContainer.innerHTML = '';

    // iterate over each log and create a list item for it
    storedLogs.forEach(log => {
        const logItem = document.createElement('li');
        logItem.textContent = log; 
        // add log to the activity log container
        activityLogContainer.appendChild(logItem);
    });
}

// load logs from local storage upon page load
loadLogsFromLocalStorage();


// function to update activity log with new message, timestamp and save to local storage
function updateActivityLog(message, timeStampDate) {
    // ref to html div
    const activityLogContainer = document.getElementById('activityLog');

    if (activityLogContainer) {
        // create a new list item for the log message
        const logItem = document.createElement('li');

        // format timestamp for display
        const timestamp = new Date(timeStampDate).toLocaleString();

        // set the text content of the list item to the message and timestamp
        logItem.textContent = `${message} - ${timestamp}`;

        // insert new log item at the top of log container
        const oldestLogItem = activityLogContainer.firstChild;
        activityLogContainer.insertBefore(logItem, oldestLogItem);

        // save log entry with its timestamp to local storage for persistence
        saveLogToLocalStorage(`${message} - ${timestamp}`);
    } else {
        console.error("Activity log container not found.");
    }
}