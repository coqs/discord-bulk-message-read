import fs from "fs";

let USER_ID = "";
let guild_id = ""; // aka server id
let discord_token = "";
let xsuperproperties = ""; //optional i think
let url_referrer = ""; // just the URL of where the chat or where you currently are (probably optional too)

let CURRENT_OFFSET = 0;
let resultamount;
let username;
let bio;
let displayname;
let pronouns;
let intervalId;

const getProfile = async () => {
  try {
    let response = await fetch(`https://discord.com/api/v9/users/${USER_ID}/profile?type=popout&with_mutual_guilds=false&with_mutual_friends=false&with_mutual_friends_count=false&guild_id=${guild_id}`, {
    "headers": {
      "accept": "*/*",
      "accept-language": "en-US,en;q=0.9,ar;q=0.8",
      "authorization": discord_token,
      "priority": "u=1, i",
      "sec-ch-ua": "\"Chromium\";v=\"136\", \"Google Chrome\";v=\"136\", \"Not.A/Brand\";v=\"99\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Windows\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-debug-options": "bugReporterEnabled",
      "x-discord-locale": "en-US",
      "x-discord-timezone": "Asia/Riyadh",
      "x-super-properties": xsuperproperties
    },
    "referrer": url_referrer,
    "referrerPolicy": "strict-origin-when-cross-origin",
    "body": null,
    "method": "GET",
    "mode": "cors",
    "credentials": "include"
  });
    if (!response.ok) {
      console.error("failed to get profile:", response.status, await response.text());
      return;
    }
    let data = await response.json();
    bio = data.user.bio;
    username = data.user.username;
    displayname = data.user.global_name;
    pronouns = data.user_profile.pronouns;
  } catch (error) {
    console.error("error:", error);
  }
};

const getMessages = async (offset) => {
  console.log(`Fetching messages with offset: ${offset}`);
  if (isNaN(offset) || typeof offset !== 'number') {
    console.error(`Invalid offset: ${offset}. Halting message fetch.`);
    return { error: true, messages: [], total_results: resultamount, count: 0, error_details: { message: "Offset is NaN or not a number" } };
  }

  try {
    const response = await fetch(`https://discord.com/api/v9/guilds/${guild_id}/messages/search?author_id=${USER_ID}&offset=${offset}`, {
    "headers": {
      "accept": "*/*",
      "authorization": discord_token,
      "priority": "u=1, i",
      "sec-ch-ua": "\"Chromium\";v=\"136\", \"Google Chrome\";v=\"136\", \"Not.A/Brand\";v=\"99\"",
      "x-super-properties": xsuperproperties
    },
    "referrer": url_referrer,
    "referrerPolicy": "strict-origin-when-cross-origin",
    "body": null,
    "method": "GET",
    "mode": "cors",
    "credentials": "include"
  });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("failed to parse json:", responseText);
      return { error: true, messages: [], total_results: resultamount, count: 0, error_details: { message: "JSON parse error", response_status: response.status, response_body: responseText } };
    }

    console.log("api (getMessages):", data);

    if (!response.ok || data.messages === undefined) {
      console.error(`errpr fetching messages (status: ${response.status}) or data.messages is undefined api response:`, data);
      return { error: true, messages: [], total_results: resultamount, count: 0, error_details: data };
    }

    if (resultamount === undefined && data.total_results !== undefined) {
      resultamount = data.total_results;
      console.log(`total results to fetch: ${resultamount}`);
    }
    
    return { messages: data.messages, total_results: data.total_results, count: data.messages.length, error: false };
  } catch (error) {
    console.error("network or other error in getMessages:", error);
    return { error: true, messages: [], total_results: resultamount, count: 0, error_details: { message: error.message } };
  }
};

const mainFunction = async () => {
    if (resultamount !== undefined && CURRENT_OFFSET >= resultamount && resultamount > 0) { // resultamount > 0 ensures we don't stop prematurely if total is 0 but not yet fetched
        console.log("FINISHED!!!!!!!");
        if (intervalId) clearInterval(intervalId);
        return;
    }
     if (resultamount === 0) { // If total results is known to be 0
        console.log("FINISHED!!!!!!! total results is 0.");
        if (intervalId) clearInterval(intervalId);
        return;
    }

    console.log(`mainFunction running. Current Offset: ${CURRENT_OFFSET}, Total Results: ${resultamount === undefined ? "Not yet known" : resultamount}`);

    let fetchResult = await getMessages(CURRENT_OFFSET);

    if (fetchResult.error) {
        console.error("Failed to get messages in mainFunction. Stopping.", fetchResult.error_details);
        if (intervalId) clearInterval(intervalId);
        return;
    }

    let messages = fetchResult.messages;
    let fetchedCountThisCall = fetchResult.count;


    if (resultamount === 0) {
        console.log("FINISHED!!!!!!! total results is 0 (confirmed after fetch).");
        if (intervalId) clearInterval(intervalId);
        return;
    }

    for (let i = 0; i < fetchedCountThisCall; i++) {
        if (messages[i] && messages[i][0] && typeof messages[i][0].content === 'string') {
            fs.appendFile('main.txt', `${messages[i][0].content}\n`, (err) => {
                if (err) {
                    console.log("file append error:", err);
                } else {
                }
            });
        } else {
            console.warn("skipping message due to unexpected structure or missing/invalid content:", messages[i]);
        }
    }

    if (fetchedCountThisCall > 0) {
        console.log(`ok, processed and wrote ${fetchedCountThisCall} messages.`);
    } else if (CURRENT_OFFSET > 0 || resultamount !== undefined) {
        console.log("no new messages returned in this batch.");
    }

    CURRENT_OFFSET += fetchedCountThisCall;

    if (resultamount !== undefined && CURRENT_OFFSET >= resultamount) {
        console.log("FINISHED!!!!!!! offset now meets or exceeds total results.");
        if (intervalId) clearInterval(intervalId);
        return;
    }
    if (fetchedCountThisCall === 0 && (CURRENT_OFFSET > 0 || resultamount !== undefined)) { 
        console.log("FINISHED!!!!!!! API returned no more messages, and offset is > 0 or total results known.");
        if (intervalId) clearInterval(intervalId);
        return;
    }
};

const run = async () => {
    await getProfile();
    if (username) { 
        fs.appendFile('main.txt', `username: ${username}, displayname: ${displayname}, pronouns: ${pronouns}, bio: ${bio}\n\n--- MESSAGES ---\n`, (err) => {
            if (err) {
                console.log("error writing profile info to file:", err);
            } else {
                console.log(`profile info sent!`);
            }
        });
    } else {
        console.log("profile information not available, cannot write to file.");
    }

    await mainFunction(); 

    if (resultamount === undefined || (CURRENT_OFFSET < resultamount && resultamount > 0)) {
        console.log(`setting up interval for subsequent fetches, next offset: ${CURRENT_OFFSET}, all: ${resultamount}`);
        intervalId = setInterval(mainFunction, 2000);
    } else {
        if (intervalId) clearInterval(intervalId);
        console.log("proccess finished after initial fetch or no messages to fetch.");
    }
};

run().catch(err => {
    console.error("uhhh:", err);
    if (intervalId) clearInterval(intervalId);
});
