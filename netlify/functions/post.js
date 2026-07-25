<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Buhweju Must Develop - People's Voice</title>

<meta property="og:type" content="article">
<meta property="og:title" content="Buhweju Must Develop - People's Voice">
<meta property="og:description" content="Leadership back to the ordinary people.">
<meta property="og:image" content="https://buhweju-must-develop.netlify.app/logo.png">

<meta name="twitter:card" content="summary_large_image">


<script type="module">

import { initializeApp } from 
"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
getFirestore,
doc,
getDoc
}
from 
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ================================================================
// FIREBASE CONFIGURATION
// ================================================================

const firebaseConfig = {

apiKey: "AIzaSyC-PINF2AJcETYIMINiCfT0gSxLxw70vSE",

authDomain: "bmd-app-1aec8.firebaseapp.com",

projectId: "bmd-app-1aec8",

storageBucket: "bmd-app-1aec8.firebasestorage.app",

messagingSenderId: "722780031230",

appId: "1:722780031230:web:cd19a98e24e4d9d80dfdaf",

measurementId: "G-WPEG8SQSW7"

};


// Initialize Firebase

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);


// ================================================================
// LOAD POST
// ================================================================

const params = new URLSearchParams(window.location.search);

const postId = params.get("post");


async function loadPost(){


if(!postId){

document.getElementById("content").innerHTML =
"<h2>No post selected</h2>";

return;

}



try {


const postRef = doc(db,"posts",postId);

const snapshot = await getDoc(postRef);



if(snapshot.exists()){


const post = snapshot.data();


// Update page title

document.title = post.title;


// Display content

document.getElementById("title").innerHTML =
post.title || "Buhweju Must Develop";


document.getElementById("description").innerHTML =
post.description || "";



// Display image

if(post.imageUrl){

document.getElementById("image").src =
post.imageUrl;

}
else{

document.getElementById("image").style.display="none";

}



}

else{


document.getElementById("content").innerHTML =
"<h2>Post not found</h2>";

}



}

catch(error){

console.error(error);

document.getElementById("content").innerHTML =
"<h2>Error loading post</h2>";

}


}


loadPost();


</script>


<style>

body{

font-family:Arial, sans-serif;

margin:0;

background:#f4f4f4;

}


.container{

max-width:800px;

margin:30px auto;

background:white;

padding:20px;

border-radius:12px;

}


img{

width:100%;

border-radius:10px;

margin-top:20px;

}


h1{

color:#1b5e20;

}


p{

font-size:18px;

line-height:1.6;

}


</style>


</head>


<body>


<div class="container" id="content">


<h1 id="title">
Loading...
</h1>


<img id="image" src="" alt="Post image">


<p id="description">
Loading...
</p>


</div>


</body>

</html>
