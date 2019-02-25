javascript:(function(){

var arts= $("div.word-item");
var totalArtNum=arts.length;
var needStudyNum=10;


// generate radom num
function random(lower, upper) {
	return Math.floor(Math.random() * (upper - lower)) + lower;
}


function studyArt(){
	var index=random(0,totalArtNum-1);
	$(arts[index]).click();
}

for(var j=0; j<needStudyNum; j++ ) {
	
   // read article every three second
   setTimeout(studyArt,(j)*3000);
	
}



})();

