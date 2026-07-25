<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Buhweju Must Develop - People's Voice</title>

<!-- Open Graph default values -->
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


// YOUR FIREBASE CONFIG
const firebaseConfig = {

apiKey: "YOUR_API_KEY",

authDomain: "YOUR_AUTH_DOMAIN",

projectId: "YOUR_PROJECT_ID",

storageBucket: "YOUR_STORAGE_BUCKET",

messagingSenderId: "YOUR_SENDER_ID",

appId: "YOUR_APP_ID"

};


const app = initializeApp(firebaseConfig);

const db = getFirestore(app);


// Get post ID from URL

const params = new URLSearchParams(window.location.search);

const postId = params.get("post");


async function loadPost(){

if(!postId){

document.getElementById("content").innerHTML =
"No post selected";

return;

}


const postRef = doc(db,"posts",postId);

const snapshot = await getDoc(postRef);


if(snapshot.exists()){


const post = snapshot.data();


document.title = post.title;


// Display post

document.getElementById("title").innerHTML =
post.title;


document.getElementById("description").innerHTML =
post.description;


if(post.imageUrl){

document.getElementById("image").src =
post.imageUrl;

}


}

else{

document.getElementById("content").innerHTML =
"Post not found";

}


}


loadPost();


</script>


<style>

body{

font-family: Arial, sans-serif;

margin:0;

background:#f5f5f5;

}


.container{

max-width:800px;

margin:auto;

background:white;

padding:20px;

}


img{

width:100%;

border-radius:10px;

}


h1{

color:#1b5e20;

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
