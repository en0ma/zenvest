// Promote only the exact main-branch production build after CI and DB migrations succeed.
// Requires a team-scoped Vercel token with deployment promotion permission.
const {VERCEL_TOKEN,VERCEL_PROJECT_ID,VERCEL_TEAM_ID,GITHUB_SHA,GITHUB_REPOSITORY,GH_TOKEN}=process.env;
for(const [name,value] of Object.entries({VERCEL_TOKEN,VERCEL_PROJECT_ID,VERCEL_TEAM_ID,GITHUB_SHA,GITHUB_REPOSITORY,GH_TOKEN})){
 if(!value)throw Error("Missing "+name);
}
const json=async(url,headers={})=>{
 const response=await fetch(url,{headers});
 if(!response.ok)throw Error("HTTP "+response.status+" requesting "+new URL(url).pathname);
 return response.json();
};
const githubHeaders={Authorization:"Bearer "+GH_TOKEN,Accept:"application/vnd.github+json"};
const vercelHeaders={Authorization:"Bearer "+VERCEL_TOKEN};
const project=encodeURIComponent(VERCEL_PROJECT_ID),team=encodeURIComponent(VERCEL_TEAM_ID);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let deployment;
for(let attempt=0;attempt<30;attempt++){
 const head=await json("https://api.github.com/repos/"+GITHUB_REPOSITORY+"/commits/main",githubHeaders);
 if(head.sha!==GITHUB_SHA){console.log("A newer main commit exists; skip outdated deployment promotion.");process.exit(0)}
 const data=await json("https://api.vercel.com/v6/deployments?projectId="+project+"&teamId="+team+"&target=production&limit=30",vercelHeaders);
 const found=(data.deployments??[]).find(d=>d.meta?.githubCommitSha===GITHUB_SHA&&d.meta?.githubCommitRef==="main");
 if(found?.state==="ERROR"||found?.state==="CANCELED")throw Error("Production build failed for "+GITHUB_SHA);
 if(found?.state==="READY"){deployment=found;break}
 await sleep(10000);
}
if(!deployment)throw Error("Timed out waiting for a READY production build matching "+GITHUB_SHA);
const url="https://api.vercel.com/v10/projects/"+project+"/promote/"+encodeURIComponent(deployment.uid??deployment.id)+"?teamId="+team;
const response=await fetch(url,{method:"POST",headers:{...vercelHeaders,"Content-Type":"application/json"},body:"{}"});
if(!response.ok)throw Error("Vercel promotion failed with HTTP "+response.status);
console.log("Promoted verified production deployment "+(deployment.uid??deployment.id)+" for commit "+GITHUB_SHA);
