var WINDOWBORDERSIZE = 10;
var HUGE = 999999; //Sometimes useful when testing for big or small numbers
var animationDelay = 200; //controls simulation and transition speed
var isRunning = false; // used in simStep and toggleSimStep
var surface; // Set in the redrawWindow function. It is the D3 selection of the svg drawing surface
var simTimer; // Set in the initialization function

//The drawing surface will be divided into logical cells
var maxCols = 40;
var cellWidth; //cellWidth is calculated in the redrawWindow function
var cellHeight; //cellHeight is calculated in the redrawWindow function

// poisson process
var exponential = 2.71828182845904523536028747135266249775724709369995957496696762772407663035354759457138217852516642742746;
var numerator, denominator;

function fact(x) {
if(x==0) {
    return 1;
}
return x * fact(x-1);
}

function poisson(k, landa) {
    exponentialPower = Math.pow(exponential, -landa); // negative power k
    landaPowerK = Math.pow(landa, k); // Landa elevated k
    numerator = exponentialPower * landaPowerK;
    denominator = fact(k); // factorial of k.

    return (numerator / denominator);
}

//Images for roads, passengers, bus stops and bus interchange, bus
const urlRedBusStop = "images/red_bus_stop.png";
const urlInterchange = "images/interchange1.png";
const urlPassengerRed = "images/passenger_red.png";
const urlPassengerGreen = "images/passenger_green.png";
const urlBus = "images/sg50-bus.png";
const urlFullMap = "images/Asset 7.png";
//positions for each bus stop and the urlInterchange
var busStop_1_Row = 3;
var busStop_1_Col = 8.7;
var busStop_2_Row = 10;
var busStop_2_Col = 8.7;
var busStop_3_Row = 15.5;
var busStop_3_Col = 19;
var interchange_Row = 1.2;
var interchange_Col = 23.5;

// a passenger enters the bus stop who are NOTONBOARD; he or she then is queueing to aboard on bus;
// then ONBOARD in the bus; then ARRIVED;
// When the passenger has ARRIVED his destination, he or she leaves the destination immediately at that point.
const ENTER = 0;
const WAITING=1;
const ONBOARD=2;
const DISAPPEAR=3; // leave the system
const REJECTED=4;


// state for bus for target location determination
const STOP1 = 1;
const PAUSE1 = 2;
const STOP2 = 3;
const PAUSE2 = 4;
const TURN1 = 5;
const STOP3 = 6;
const PAUSE3 = 7;
const TURN2 = 8;
const STRAIGHT = 9;
const TERMINAL = 10;

const ARRIVED = 11;
const EXITED=12;


// There are two types of bus stops in our system: Bus Stop and Interchange
const BUSSTOP = 0;
const INTERCHANGE = 1;

//passengers at bus stop 1,2,3 are dynamic lists, initially empty.
var passenger_1 = [];
var passenger_2 = [];
var passenger_3 = [];

var buses = [];
var nextBusId = 0; // ID for next entering bus

var busCapacity = 20;

// the u-shaped road map
var map = [
  {"label":"Map", "startRow":0,"numRows":8,"startCol":10,"numCols":10,"ratio":1.9,"url":urlFullMap}
];

// This list contains the locations for each bus stop and the interchange for adding in images
var busstops = [
  {"type":BUSSTOP,"label":"Bus Stop 1", "location":{"row":busStop_1_Row,"col":busStop_1_Col},"width":2.2,"height":3.2},
  {"type":BUSSTOP,"label":"Bus Stop 2", "location":{"row":busStop_2_Row,"col":busStop_2_Col},"width":2.2,"height":3.2},
  {"type":BUSSTOP,"label":"Bus Stop 3", "location":{"row":busStop_3_Row,"col":busStop_3_Col},"width":2.2,"height":3.2},
  {"type":INTERCHANGE,"label":"Interchange", "location":{"row":interchange_Row,"col":interchange_Col},"width":4.5,"height":4.5}
];

var busStop1 = busstops[0];
var busStop2 = busstops[1];
var busStop3 = busstops[2];
var interchange = busstops[3];

// waiting area at bus stop
var busStopWaitingArea = [
   {"label":"Bus Stop 1 Waiting Area","startRow":busStop_1_Row,"numRows":busStop1.width,"startCol":busStop_1_Col-3, "numCols":busStop1.height-1},
   {"label":"Bus Stop 2 Waiting Area","startRow":busStop_2_Row,"numRows":busStop2.width,"startCol":busStop_2_Col-3, "numCols":busStop2.height-1},
   {"label":"Bus Stop 3 Waiting Area","startRow":busStop_3_Row,"numRows":busStop3.width,"startCol":busStop_3_Col-3, "numCols":busStop3.height-1}
];

var waitingArea_1 = busStopWaitingArea[0];
var waitingArea_2 = busStopWaitingArea[1];
var waitingArea_3 = busStopWaitingArea[2];


var busTarget = [
  {"state":ENTER,"row":1,"col":11.5},
  {"state":STOP1,"row":busStop_1_Row,"col":11.5},
  {"state":STOP2,"row":busStop_2_Row,"col":11.5},
  {"state":TURN1,"row":busStop_3_Row-3,"col":11.5},
  {"state":STOP3,"row":busStop_3_Row-3,"col":busStop_3_Col},
  {"state":TURN2,"row":busStop_3_Row-3,"col":24},
  {"state":STRAIGHT,"row":interchange_Row+5,"col":24},
  {"state":TERMINAL,"row":interchange_Row+3,"col":24}
];

var enter = busTarget[0];
var stop1 = busTarget[1];
var stop2 = busTarget[2];
var turn1 = busTarget[3];
var stop3 = busTarget[4];
var turn2 = busTarget[5];
var straight = busTarget[6];
var terminal = busTarget[7];

var currentTime = 0;


var statistics = [
{"name":"Average waiting time: ","location":{"row":busStop_1_Row+3,"col":busStop_1_Col-8},"cumulativeValue":0,"count":0},
{"name":"Average waiting time: ","location":{"row":busStop_2_Row+3,"col":busStop_2_Col-8},"cumulativeValue":0,"count":0},
{"name":"Average waiting time: ","location":{"row":busStop_3_Row+3,"col":busStop_3_Col-8},"cumulativeValue":0,"count":0},
{"name":"Time of Simulation: ","location":{"row":5,"col":16},"cumulativeValue":0,"count":1}
];

// To count the total number of passengers at bus stop 1/2/3 who have missed a bus
var missedBus = [
  {"name":"Passengers Missed a Bus: ","location":{"row":busStop_1_Row+3.5,"col":busStop_1_Col-6},"count":0},
  {"name":"Passengers Missed a Bus: ","location":{"row":busStop_2_Row+3.5,"col":busStop_2_Col-6},"count":0},
  {"name":"Passengers Missed a Bus: ","location":{"row":busStop_3_Row+3.5,"col":busStop_3_Col-6},"count":0}
];

// To count the total number of passengers who have alighted at bus stop 2/3/bus interchange
var alightedPassengers = [
  {"name":"Alighted Passengers: ","location":{"row":busStop_2_Row+4,"col":busStop_2_Col-8},"count":0},
  {"name":"Alighted Passengers: ","location":{"row":busStop_3_Row+4,"col":busStop_3_Col-8},"count":0},
  {"name":"Alighted Passengers: ","location":{"row":interchange_Row+3.5,"col":busStop_3_Col+8},"count":0}
];

// probability of bus arrival
var probBusArrival = 0.01;

// probability of passengers' arrival at bus stop 1
var probArrival_1 = 0.02;

//bus stop 1: probability of the passengers' destination which is bus stop 2 or 3 or interchange
var probBusStop_1_2 = 0.2;
var probBusStop_1_3 = 0.4;

// probability of passengers' arrival at bus stop 2
var probArrival_2 = 0.02;

//bus stop 2: probability of the passengers' destination which is bus stop 3 or interchange
var probBusStop_2_3 = 0.3;

// probability of passengers' arrival at bus stop 3
var probArrival_3 = 0.02;

// We can have different types of passengers (Red and Green) according to a probability, probRed.
// This version of the simulation makes no difference between Red and Green passengers except for the display image
var probGreen = 0.5;

// This next function is executed when the script is loaded. It contains the page initialization code.
(function() {
	// Your page initialization code goes here
	// All elements of the DOM will be available here
	window.addEventListener("resize", redrawWindow); //Redraw whenever the window is resized
	simTimer = window.setInterval(simStep, animationDelay); // call the function simStep every animationDelay milliseconds
	redrawWindow();
})();

// We need a function to start and pause the the simulation.
function toggleSimStep(){
	//this function is called by a click event on the html page.
	// Search BasicAgentModel.html to find where it is called.
	isRunning = !isRunning;
	console.log("isRunning: "+isRunning);
}

function redrawWindow(){
	isRunning = false; // used by simStep
	window.clearInterval(simTimer); // clear the Timer
	animationDelay = 550 - document.getElementById("slider1").value;
	simTimer = window.setInterval(simStep, animationDelay); // call the function simStep every animationDelay milliseconds

	// Re-initialize simulation variables
	currentTime = 0;
  // Average waiting time at bus stop 1
  statistics[0].cumulativeValue=0;
  statistics[0].count=0;
  // Average waiting time at bus stop 2
  statistics[1].cumulativeValue=0;
  statistics[1].count=0;
  // Average waiting time at bus stop 3
  statistics[2].cumulativeValue=0;
  statistics[2].count=0;
  // Time of simulation
  statistics[3].cumulativeValue=0;
  statistics[3].count=0;
  // number of passengers missed a bus at bus stop 1,2 and 3
  missedBus[0].count=0;
  missedBus[1].count=0;
  missedBus[2].count=0;
  // number of passengers alighted at the bus stop / interchange
  alightedPassengers[0].count=0; // alight at bus stop 2
  alightedPassengers[1].count=0; // alight at bus stop 3
  alightedPassengers[2].count=0; // alight at bus interchange

  passenger_1 = [];
  passenger_2 = [];
  passenger_3 = [];

  buses = [];
  nextBusId = 0; // increment this and assign it to the next entering bus

	//resize the drawing surface; remove all its contents;
	var drawsurface = document.getElementById("surface");
	var creditselement = document.getElementById("credits");
	var w = window.innerWidth;
	var h = window.innerHeight;
	var surfaceWidth =(w - 3*WINDOWBORDERSIZE);
	var surfaceHeight= (h-creditselement.offsetHeight - 3*WINDOWBORDERSIZE);

	drawsurface.style.width = surfaceWidth+"px";
	drawsurface.style.height = surfaceHeight+"px";
	drawsurface.style.left = WINDOWBORDERSIZE/2+'px';
	drawsurface.style.top = WINDOWBORDERSIZE/2+'px';
	drawsurface.style.border = "thick solid #669999"; //The border is mainly for debugging; okay to remove it
	drawsurface.innerHTML = ''; //This empties the contents of the drawing surface, like jQuery erase().

	// Compute the cellWidth and cellHeight, given the size of the drawing surface
	numCols = maxCols;
	cellWidth = surfaceWidth/numCols;
	numRows = Math.ceil(surfaceHeight/cellWidth);
	cellHeight = surfaceHeight/numRows;

	// In other functions we will access the drawing surface using the d3 library.
	//Here we set the global variable, surface, equal to the d3 selection of the drawing surface
	surface = d3.select('#surface');
	surface.selectAll('*').remove(); // we added this because setting the inner html to blank may not remove all svg elements
	surface.style("font-size","100%");
	// rebuild contents of the drawing surface
	updateSurface();
};

// The window is resizable, so we need to translate row and column coordinates into screen coordinates x and y
function getLocationCell(location){
	var row = location.row;
	var col = location.col;
	var x = (col-1)*cellWidth; //cellWidth is set in the redrawWindow function
	var y = (row-1)*cellHeight; //cellHeight is set in the redrawWindow function
	return {"x":x,"y":y};
}

function updateSurface(){
	// This function is used to create or update most of the svg elements on the drawing surface.
	// See the function removeDynamicAgents() for how we remove svg elements
  var allmap = surface.selectAll(".map").data(map);
  var newmap = allmap.enter().append("g").attr("class","map");
  newmap.append("svg:image")
  .attr("x",function(d){return (d.startCol-1)*cellWidth;})
  .attr("y",function(d){return (d.startRow-1)*cellHeight;})
  .attr("width",function(d){return d.numCols*cellHeight*d.ratio;})
  .attr("height",function(d){return d.numRows*cellHeight*d.ratio;})
  .attr("xlink:href",urlFullMap)

  // bus stop 1
  var allpassenger_1 = surface.selectAll(".passenger_1").data(passenger_1);
  // If the list of svg elements is longer than the data list, the excess elements are in the .exit() list
  // Excess elements need to be removed:
  allpassenger_1.exit().remove(); //remove all svg elements associated with entries that are no longer in the data list
  var newpassenger_1 = allpassenger_1.enter().append("g").attr("class","passenger_1");
  newpassenger_1.append("svg:image")
  .attr("x",function(d){var cell= getLocationCell(d.location); return cell.x+"px";})
	.attr("y",function(d){var cell= getLocationCell(d.location); return cell.y+"px";})
	.attr("width",Math.min(cellWidth,cellHeight)+"px")
	.attr("height", Math.min(cellWidth,cellHeight)+"px")
	.attr("xlink:href",function(d){if (d.type=="G") return urlPassengerGreen; else return urlPassengerRed;});

  var images_1 = allpassenger_1.selectAll("image");
  images_1.transition()
  .attr("x",function(d){var cell= getLocationCell(d.location); return cell.x+"px";})
  .attr("y",function(d){var cell= getLocationCell(d.location); return cell.y+"px";})
  .duration(animationDelay).ease('linear'); // This specifies the speed and type of transition we want.

  // bus stop 2
  var allpassenger_2 = surface.selectAll(".passenger_2").data(passenger_2);
  allpassenger_2.exit().remove(); //remove all svg elements associated with entries that are no longer in the data list
  var newpassenger_2 = allpassenger_2.enter().append("g").attr("class","passenger_2");
  newpassenger_2.append("svg:image")
  .attr("x",function(d){var cell= getLocationCell(d.location); return cell.x+"px";})
	.attr("y",function(d){var cell= getLocationCell(d.location); return cell.y+"px";})
	.attr("width", Math.min(cellWidth,cellHeight)+"px")
	.attr("height", Math.min(cellWidth,cellHeight)+"px")
	.attr("xlink:href",function(d){if (d.type=="G") return urlPassengerGreen; else return urlPassengerRed;});

  var images_2 = allpassenger_2.selectAll("image");
  images_2.transition()
  .attr("x",function(d){var cell= getLocationCell(d.location); return cell.x+"px";})
  .attr("y",function(d){var cell= getLocationCell(d.location); return cell.y+"px";})
  .duration(animationDelay).ease('linear'); // This specifies the speed and type of transition we want.


  // bus stop 3
  var allpassenger_3 = surface.selectAll(".passenger_3").data(passenger_3);
  allpassenger_3.exit().remove(); //remove all svg elements associated with entries that are no longer in the data list
  var newpassenger_3 = allpassenger_3.enter().append("g").attr("class","passenger_3");
  newpassenger_3.append("svg:image")
  .attr("x",function(d){var cell= getLocationCell(d.location); return cell.x+"px";})
  .attr("y",function(d){var cell= getLocationCell(d.location); return cell.y+"px";})
  .attr("width", Math.min(cellWidth,cellHeight)+"px")
  .attr("height", Math.min(cellWidth,cellHeight)+"px")
  .attr("xlink:href",function(d){if (d.type=="G") return urlPassengerGreen; else return urlPassengerRed;});

  var images_3 = allpassenger_3.selectAll("image");
  images_3.transition()
  .attr("x",function(d){var cell= getLocationCell(d.location); return cell.x+"px";})
  .attr("y",function(d){var cell= getLocationCell(d.location); return cell.y+"px";})
  .duration(animationDelay).ease('linear'); // This specifies the speed and type of transition we want.

  // Bus Stops
  var allbusstops = surface.selectAll(".busstops").data(busstops);
  var newbusstops = allbusstops.enter().append("g").attr("class","busstop");
  newbusstops.append("svg:image")
  .attr("x",function(d){var cell= getLocationCell(d.location); return cell.x+"px";})
  .attr("y",function(d){var cell= getLocationCell(d.location); return cell.y+"px";})
  .attr("width", function(d){return d.width*cellHeight;})
  .attr("height", function(d){return d.height*cellHeight;})
  .attr("xlink:href",function(d){if (d.type==BUSSTOP) return urlRedBusStop; else return urlInterchange;});

  newbusstops.append("text")
  .attr("x", function(d) { var cell= getLocationCell(d.location); return (cell.x)+"px"; })
  .attr("y", function(d) { var cell= getLocationCell(d.location); return (cell.y)+"px"; })
  .attr("dy", ".35em")
  .attr("font-size","15px")
  .text(function(d) { return d.label; });

  // Buses
  var allbus = surface.selectAll(".buses").data(buses);
  allbus.exit().remove();//remove all svg elements associated with entries that are no longer in the data list
  var newbus = allbus.enter().append("g").attr("class","buses");
  newbus.append("svg:image")
  .attr("x",function(d){var cell= getLocationCell(d.location); return cell.x+"px";})
  .attr("y",function(d){var cell= getLocationCell(d.location); return cell.y+"px";})
  .attr("width", 3*cellWidth)
  .attr("height", 2*cellHeight)
  .attr("xlink:href",urlBus);

  var images_bus = allbus.selectAll("image");
  images_bus.transition()
  .attr("x",function(d){var cell= getLocationCell(d.location); return cell.x+"px";})
  .attr("y",function(d){var cell= getLocationCell(d.location); return cell.y+"px";})
  .duration(animationDelay).ease('linear'); // This specifies the speed and type of transition we want.

  newbus.append("text")
  .attr("x",function(d){var cell = getLocationCell(d.location); return (cell.x+cellWidth)+"px";})
  .attr("y",function(d){var cell = getLocationCell(d.location); return (cell.y+cellHeight/2)+"px";})
  .attr("dy",".35em")
  .text("");

  allbus.selectAll("text").text(function(d){
    return d.space;
  });
  var texts_bus = allbus.selectAll("text");
  texts_bus.transition()
  .attr("x",function(d){var cell= getLocationCell(d.location); return (cell.x+cellHeight)+"px";})
  .attr("y",function(d){var cell= getLocationCell(d.location); return (cell.y-cellHeight/2)+"px";})
  .duration(animationDelay).ease('linear');


	// The simulation should serve some purpose
	// so we will compute and display the average length of stay of each patient type.
	// We created the array "statistics" for this purpose.
	// Here we will create a group for each element of the statistics array (two elements)
	var allstatistics = surface.selectAll(".statistics").data(statistics);
	var newstatistics = allstatistics.enter().append("g").attr("class","statistics");
	// For each new statistic group created we append a text label
	newstatistics.append("text")
	.attr("x", function(d) { var cell= getLocationCell(d.location); return (cell.x+cellWidth)+"px"; })
  .attr("y", function(d) { var cell= getLocationCell(d.location); return (cell.y+cellHeight/2)+"px"; })
  .attr("dy", ".15em")
  .attr("font-size","15px")
  .text("");
	// The data in the statistics array are always being updated.
	// So, here we update the text in the labels with the updated information.
	allstatistics.selectAll("text").text(function(d) {
		var avgLengthOfStay = d.cumulativeValue/(Math.max(1,d.count)); // cumulativeValue and count for each statistic are always changing
		return d.name+avgLengthOfStay.toFixed(1); }); //The toFixed() function sets the number of decimal places to display

  var allmissedBus = surface.selectAll(".missedBus").data(missedBus);
  var newmissedBus = allmissedBus.enter().append("g").attr("class","missedBus");
  newmissedBus.append("text")
  .attr("x",function(d) { var cell= getLocationCell(d.location); return (cell.x-cellWidth)+"px"; })
  .attr("y", function(d) { var cell= getLocationCell(d.location); return (cell.y+cellHeight/2)+"px"; })
  .attr("dy", ".15em")
  .attr("font-size","15px")
  .text("");

  allmissedBus.selectAll("text").text(function(d){return d.name + d.count;});

  var allalightedPassengers = surface.selectAll(".alightedPassengers").data(alightedPassengers);
  var newalightedPassengers = allalightedPassengers.enter().append("g").attr("class","alightedPassengers");
  newalightedPassengers.append("text")
  .attr("x", function(d) { var cell= getLocationCell(d.location); return (cell.x+cellWidth)+"px"; })
  .attr("y", function(d) { var cell= getLocationCell(d.location); return (cell.y+cellHeight/2)+"px"; })
  .attr("dy", ".15em")
  .attr("font-size","15px")
  .text("");
  allalightedPassengers.selectAll("text").text(function(d){return d.name + d.count;});

}

function addDynamicAgents(){
  // Adding passengers to Bus Stop 1
  if (Math.random()< probArrival_1){
  	var newpassenger_1 = {"type":"G","location":{"row":busStop_1_Row,"col":1},"target":{"row":waitingArea_1.startRow,"col":waitingArea_1.startCol},"state":ENTER,"timeAdmitted":0,"busId":0,"destination":TERMINAL,"rejectedBusId":[]};
  	if (Math.random()<probGreen) newpassenger_1.type = "G";
  	else newpassenger_1.type = "R";

    // each passenger at bus stop 1 could have different destinations to alight, stop2, stop3 and bus interchange
    if (Math.random()<probBusStop_1_2){
      newpassenger_1.destination = STOP2;
    } else {
      if (Math.random()<probBusStop_1_3){
        newpassenger_1.destination = STOP3;
      } else newpassenger_1.destination = TERMINAL;
    };
    passenger_1.push(newpassenger_1);
  }

  // Adding passengers to Bus Stop 2
  if (Math.random()< probArrival_2){
  	var newpassenger_2 = {"type":"G","location":{"row":busStop_2_Row,"col":1},"target":{"row":waitingArea_2.startRow,"col":waitingArea_2.startCol},"state":ENTER,"timeAdmitted":0,"destination":TERMINAL,"busId":0,"rejectedBusId":[]};
  	if (Math.random()<probGreen) newpassenger_2.type = "G";
  	else newpassenger_2.type = "R";

    // each passenger at bus stop 2 could have different destinations to alight, stop3 and bus interchange
    if (Math.random()<probBusStop_2_3){
      newpassenger_2.destination = STOP3;
    } else newpassenger_2.destination = TERMINAL;

  	passenger_2.push(newpassenger_2);
  }

  // Adding passengers to Bus Stop 3
  if (Math.random()< probArrival_3){
  	var newpassenger_3 = {"type":"G","location":{"row":busStop_3_Row,"col":1},"target":{"row":waitingArea_3.startRow,"col":waitingArea_3.startCol},"state":ENTER,"timeAdmitted":0,"destination":TERMINAL,"busId":0,"rejectedBusId":[]};
  	if (Math.random()<probGreen) newpassenger_3.type = "G";
  	else newpassenger_3.type = "R";

  	passenger_3.push(newpassenger_3);
	}

  // Generate Bus Arrivals
  if (Math.random()<probBusArrival){
    var newbus = {"id":1,"location":{"row":enter.row,"col":enter.col},"target":{"row":stop1.row,"col":stop1.col},"state":ENTER,"space":busCapacity,"capacity":busCapacity,"destination_stop2":0,"destination_stop3":0,"destination_terminal":0};
    buses.push(newbus);
  }
};

function updateBus(busIndex){
  busIndex = Number(busIndex);
  var bus = buses[busIndex];
  //get the current location of the bus
  var row = bus.location.row;
  var col = bus.location.col;
  var state = bus.state;
  var space = bus.space;

  var hasArrived = (Math.abs(bus.target.row - row)+Math.abs(bus.target.col-col))==0;

  switch(state){
    case ENTER:
      if (hasArrived) {
        bus.state = STOP1;
        bus.target.row = stop1.row;
        bus.target.col = stop1.col;
        // Assign each bus an ID
        bus.id = ++nextBusId
      }

    case STOP1:
      if (hasArrived){
        var waitingList = [];
        var onboardList = [];
        // make sure all the passenger have checked whether they are able to take the bus
        // states of passengers should be changed to either onboard or rejected instead of waiting
        // if the passenger is able to take the bus and has arrived at the staging point, the state would be switched to DISAPPEAR
        for (var i=0;i<passenger_1.length;i++){
          var passenger = passenger_1[i];
          if (passenger.state == WAITING){
            waitingList.push(passenger.id);
          }
          if (passenger.state == ONBOARD){
            if (passenger.busId == bus.id){
              onboardList.push(passenger.id);
            }
          }
        }
        // the bus will leave only when
        // the waiting area is empty and the graphics of onboarding passengers have been deleted
        if (waitingList.length == 0){
          if (onboardList.length == 0){
            bus.state = PAUSE1;
            bus.target.row = stop1.row;
            bus.target.col = stop1.col;
            bus.space = bus.capacity;
          }
        }
      }
    break;
    case PAUSE1:
      if (hasArrived){
        bus.state = STOP2;
        bus.target.row = stop2.row;
        bus.target.col = stop2.col;
        bus.capacity = bus.capacity + bus.destination_stop2;
      }
    break;
    case STOP2:
      if (hasArrived){
        if (bus.capacity > 0){
          var waitingList = [];
          var onboardList = [];
          for (var i=0;i<passenger_2.length;i++){
            var passenger = passenger_2[i];
            if (passenger.state == WAITING){
              waitingList.push(passenger.id);
            }
            if (passenger.state == ONBOARD){
              if (passenger.busId == bus.id){
                onboardList.push(passenger.id);
              }
            }
          }
          // the bus will leave only when the waiting area is empty
          if (waitingList.length == 0){
            if (onboardList.length == 0){
              bus.state = PAUSE2;
              bus.target.row = stop2.row;
              bus.target.col = stop2.col;
              bus.space = bus.capacity;
            }
          }
        } else {
          // if the bus has no space for more passengers, the bus will leave immediately
          bus.state = TURN1;
          bus.target.row = turn1.row;
          bus.target.col = turn1.col;
          bus.space = bus.capacity;
          if (bus.destination_stop2 > 0){
            alightedPassengers[0].count = alightedPassengers[0].count + bus.destination_stop2;
          }
        }
      }
    break;
    case PAUSE2:
      if (hasArrived){
        bus.state = TURN1;
        bus.target.row = turn1.row;
        bus.target.col = turn1.col;
        alightedPassengers[0].count = alightedPassengers[0].count + bus.destination_stop2;
      }
    break;
    case TURN1:
      if (hasArrived){
        bus.state = STOP3;
        bus.target.row = stop3.row;
        bus.target.col = stop3.col;
        bus.capacity = bus.capacity + bus.destination_stop3;
      }
    break;
    case STOP3:
      if (hasArrived){
        if (bus.capacity > 0){
          var waitingList = [];
          var onboardList = [];
          for (var i=0;i<passenger_3.length;i++){
            var passenger = passenger_3[i];
            if (passenger.state == WAITING){
              waitingList.push(passenger.id);
            }
            if (passenger.state == ONBOARD){
              if (passenger.busId == bus.id){
                onboardList.push(passenger.id);
              }
            }
          }
          // the bus will leave only when the waiting area is empty
          if (waitingList.length == 0){
            if (onboardList.length == 0){
              bus.state = PAUSE3;
              bus.target.row = stop3.row;
              bus.target.col = stop3.col;
              bus.space = bus.capacity;
            }
          }
        } else {
          // if the bus has no space for more passengers, the bus will leave immediately
          bus.state = TURN2;
          bus.target.row = turn2.row;
          bus.target.col = turn2.col;
          bus.space = bus.capacity;
          if (bus.destination_stop3 > 0){
            // update the number of passengers alighted at bus stop 3
            alightedPassengers[1].count = alightedPassengers[1].count + bus.destination_stop3;
          }
        }
      }
    break;
    case PAUSE3:
      if (hasArrived){
        bus.state = TURN2;
        bus.target.row = turn2.row;
        bus.target.col = turn2.col;
        // update the number of passengers alighted at bus stop 3
        alightedPassengers[1].count = alightedPassengers[1].count + bus.destination_stop3;
      }
    break;
    case TURN2:
      if (hasArrived){
        bus.state = STRAIGHT;
        bus.target.row = straight.row;
        bus.target.col = straight.col;
      }
    break;
    case STRAIGHT:
      if (hasArrived){
        bus.state = TERMINAL;
        bus.target.row = terminal.row;
        bus.target.col = terminal.col;
      }
    break;
    case TERMINAL:
      if (hasArrived){
        bus.target.row = terminal.row;
        bus.target.col = terminal.col;
        alightedPassengers[2].count = alightedPassengers[2].count + bus.destination_terminal;
        bus.state = ARRIVED;
      }
    break;
    case ARRIVED:
      if (hasArrived){
        bus.state = EXITED;
      }
    break;
    default:
    break;
  }
  var targetRow = bus.target.row;
  var targetCol = bus.target.col;
  var rowsToGo = targetRow - row;
  var colsToGo = targetCol - col;
  var cellsPerStep = 0.6;
  var newRow = row + Math.min(Math.abs(rowsToGo),cellsPerStep)*Math.sign(rowsToGo);
  var newCol = col + Math.min(Math.abs(colsToGo),cellsPerStep)*Math.sign(colsToGo);
  bus.location.row = newRow;
	bus.location.col = newCol;
}

// This function is to update the position and state of passengers at bus stop 1
function updatePassenger_1(passengerIndex){
  //passengerIndex is an index into the passengers data array
  passengerIndex = Number(passengerIndex); //it seems passengerIndex was coming in as a string
  var passenger = passenger_1[passengerIndex];
  //get the current location of the patient
  var row = passenger.location.row;
  var col = passenger.location.col;
  var type = passenger.type;
  var state = passenger.state;
  var busId = passenger.busId;
  var rejectedBusId = passenger.rejectedBusId;

  //etermine if patient has arrived at destination
  var hasArrived = (Math.abs(passenger.target.row-row)+Math.abs(passenger.target.col-col))==0;

  //Behavior of passenger depends on his or her state
  switch(state){
    case ENTER:
      if (hasArrived){
        passenger.state = WAITING;
        // pick a random spot in the waiting area for passengers at bus stop 1 or 2 or 3
        passenger.target.row = waitingArea_1.startRow+Math.floor(Math.random()*waitingArea_1.numRows);
        passenger.target.col = waitingArea_1.startCol+Math.floor(Math.random()*waitingArea_1.numCols);
      }
    break;
    case WAITING:
      if (hasArrived){
        passenger.timeAdmitted = currentTime;
        // check every bus in the buses list, which is at bus stop 1
        for (var i=0;i< buses.length;i++){
          var bus = buses[i];
          if (bus.state == STOP1){
            if (passenger.rejectedBusId.includes(bus.id) == true){
              passenger.state = REJECTED;
            } else {
              if (bus.capacity > 0){
                passenger.state = ONBOARD;
                passenger.busId = bus.id;
                // When the passenger is able to onboard, he will go to the pick up point
                passenger.target.row = stop1.row;
                passenger.target.col = stop1.col - 1;
                // update the capacity of the bus
                bus.capacity = bus.capacity - 1;
                // check destination of the passenger and update the bus states
                if (passenger.destination == STOP2){
                  bus.destination_stop2 = ++bus.destination_stop2;
                }
                if (passenger.destination == STOP3){
                  bus.destination_stop3 = ++bus.destination_stop3;
                }
                if (passenger.destination == TERMINAL){
                  bus.destination_terminal = ++bus.destination_terminal;
                }
                break;
              } else {
                passenger.rejectedBusId.push(bus.id);
                passenger.state = REJECTED;
                // if the bus has not enough space for the passenger
                // the passenger will go back to waiting area until the next bus arrives at bus stop 1
                // the state of the passenger will remain as WAITING
                missedBus[0].count = missedBus[0].count+1;
              }
            }
          }
        }
      }
    break;
    case REJECTED:
      for (var i=0;i< buses.length;i++){
        var bus = buses[i];
        if (bus.state == ENTER){
          if (passenger.rejectedBusId.includes(bus.id) == false){
            passenger.state = WAITING;
          }
        }
      }
    break;
    case ONBOARD:
      if (hasArrived){
        for (var i=0;i< buses.length;i++){
          var bus = buses[i];
          if (bus.id == passenger.busId){
            if (bus.location.row == stop1.row){
              passenger.state = DISAPPEAR;
              var timeInBusStop = currentTime - passenger.timeAdmitted;
              statistics[0].cumulativeValue = statistics[0].cumulativeValue + timeInBusStop;
              statistics[0].count = statistics[0].count + 1;
            }
          }
        }
      }
    break;
    case DISAPPEAR:
      passenger.state = EXITED;
    break;
    default:
    break;
  }

//------------------------------------------------------------------------------------------------
  // set the destination row and columns
  var targetRow = passenger.target.row;
  var targetCol = passenger.target.col;
  // compute the distance to the target destination
  var rowsToGo = targetRow-row;
  var colsToGo = targetCol-col;
  // set the speed
  var cellsPerStep = 1;
  // compute the cell to move to
  var newRow = row+Math.min(Math.abs(rowsToGo),cellsPerStep)*Math.sign(rowsToGo);
	var newCol = col + Math.min(Math.abs(colsToGo),cellsPerStep)*Math.sign(colsToGo);
  // update the location of the passenger
  passenger.location.row = newRow;
  passenger.location.col = newCol;
}

// This function is to update the position and state of passengers at bus stop 2
function updatePassenger_2(passengerIndex){
  //passengerIndex is an index into the passengers data array
  passengerIndex = Number(passengerIndex); //it seems passengerIndex was coming in as a string
  var passenger = passenger_2[passengerIndex]; // passengers here would be passenger_A, passenger_B,passenger_C
  //get the current location of the patient
  var row = passenger.location.row;
  var col = passenger.location.col;
  var type = passenger.type;
  var state = passenger.state;
  var busId = passenger.busId;
  var rejectedBusId = passenger.rejectedBusId;

  //etermine if patient has arrived at destination
  var hasArrived = (Math.abs(passenger.target.row-row)+Math.abs(passenger.target.col-col))==0;

  //Behavior of passenger depends on his or her state
  switch(state){
    case ENTER:
      if (hasArrived){
        passenger.state = WAITING;
        // pick a random spot in the waiting area for passengers at bus stop 1 or 2 or 3
        passenger.target.row = waitingArea_2.startRow+Math.floor(Math.random()*waitingArea_2.numRows);
        passenger.target.col = waitingArea_2.startCol+Math.floor(Math.random()*waitingArea_2.numCols);
      }
    break;
    case WAITING:
      if (hasArrived){
        passenger.timeAdmitted = currentTime;
        // check every bus in the buses list, which is at bus stop 1
        for (var i=0;i< buses.length;i++){
          var bus = buses[i];
          if (bus.state == STOP2){
            if (passenger.rejectedBusId.includes(bus.id) == true){
              passenger.state = REJECTED;
            } else {
              if (bus.capacity > 0){
                passenger.state = ONBOARD;
                passenger.busId = bus.id;
                // When the passenger is able to onboard, he will go to the pick up point
                passenger.target.row = stop2.row;
                passenger.target.col = stop2.col - 1;
                // update the capacity of the bus
                bus.capacity = bus.capacity - 1;
                // check destination of the passenger and update the bus states
                if (passenger.destination == STOP3){
                  bus.destination_stop3 = ++bus.destination_stop3;
                }
                if (passenger.destination == TERMINAL){
                  bus.destination_terminal = ++bus.destination_terminal;
                }
                break;
              } else {
                passenger.rejectedBusId.push(bus.id);
                passenger.state = REJECTED;
                // if the bus has not enough space for the passenger
                // the passenger will go back to waiting area until the next bus arrives at bus stop 1
                // the state of the passenger will remain as WAITING
                missedBus[1].count = missedBus[1].count+1;
              }
            }
          }
        }
      }
    break;
    case REJECTED:
      for (var i=0;i< buses.length;i++){
        var bus = buses[i];
        if (bus.state == PAUSE1){
          if (passenger.rejectedBusId.includes(bus.id) == false){
            passenger.state = WAITING;
          }
        }
      }
    break;
    case ONBOARD:
      if (hasArrived){
        for (var i=0;i< buses.length;i++){
          var bus = buses[i];
          if (bus.id == passenger.busId){
            if (bus.location.row == stop2.row){
              passenger.state = DISAPPEAR;
              var timeInBusStop = currentTime - passenger.timeAdmitted;
              statistics[1].cumulativeValue = statistics[1].cumulativeValue + timeInBusStop;
              statistics[1].count = statistics[1].count + 1;
            }
          }
        }
      }
    break;
    case DISAPPEAR:
      passenger.state = EXITED;
    break;
    default:
    break;
  }

//------------------------------------------------------------------------------------------------
  // set the destination row and columns
  var targetRow = passenger.target.row;
  var targetCol = passenger.target.col;
  // compute the distance to the target destination
  var rowsToGo = targetRow-row;
  var colsToGo = targetCol-col;
  // set the speed
  var cellsPerStep = 1;
  // compute the cell to move to
  var newRow = row+Math.min(Math.abs(rowsToGo),cellsPerStep)*Math.sign(rowsToGo);
	var newCol = col + Math.min(Math.abs(colsToGo),cellsPerStep)*Math.sign(colsToGo);
  // update the location of the passenger
  passenger.location.row = newRow;
  passenger.location.col = newCol;
}

// This function is to update the position and state of passengers at bus stop 2
function updatePassenger_3(passengerIndex){
  //passengerIndex is an index into the passengers data array
  passengerIndex = Number(passengerIndex); //it seems passengerIndex was coming in as a string
  var passenger = passenger_3[passengerIndex]; // passengers here would be passenger_A, passenger_B,passenger_C
  //get the current location of the patient
  var row = passenger.location.row;
  var col = passenger.location.col;
  var type = passenger.type;
  var state = passenger.state;
  var busId = passenger.busId;
  var rejectedBusId = passenger.rejectedBusId;

  //etermine if patient has arrived at destination
  var hasArrived = (Math.abs(passenger.target.row-row)+Math.abs(passenger.target.col-col))==0;

  //Behavior of passenger depends on his or her state
  switch(state){
    case ENTER:
      if (hasArrived){
        passenger.state = WAITING;
        // pick a random spot in the waiting area for passengers at bus stop 1 or 2 or 3
        passenger.target.row = waitingArea_3.startRow+Math.floor(Math.random()*waitingArea_3.numRows);
        passenger.target.col = waitingArea_3.startCol+Math.floor(Math.random()*waitingArea_3.numCols);
      }
    break;
    case WAITING:
      if (hasArrived){
        passenger.timeAdmitted = currentTime;
        // check every bus in the buses list, which is at bus stop 1
        for (var i=0;i< buses.length;i++){
          var bus = buses[i];
          if (bus.state == STOP3){
            if (passenger.rejectedBusId.includes(bus.id) == true){
              passenger.state = REJECTED;
            } else {
              if (bus.capacity > 0){
                passenger.state = ONBOARD;
                passenger.busId = bus.id;
                // When the passenger is able to onboard, he will go to the pick up point
                passenger.target.row = stop3.row+2;
                passenger.target.col = stop3.col+1;
                // update the capacity of the bus
                bus.capacity = bus.capacity - 1;
                // check destination of the passenger and update the bus states
                // the destination of the passengers from bus stop 3 will only be the bus terminal
                bus.destination_terminal = ++bus.destination_terminal;
                break;
              } else {
                  passenger.rejectedBusId.push(bus.id);
                  passenger.state = REJECTED;
                  // if the bus has not enough space for the passenger
                  // the passenger will go back to waiting area until the next bus arrives at bus stop 1
                  // the state of the passenger will remain as WAITING
                  missedBus[2].count = missedBus[2].count+1;
                }
              }
            }
          }
        }
    break;
    case REJECTED:
      for (var i=0;i< buses.length;i++){
        var bus = buses[i];
        if (bus.state == TURN1){
          if (passenger.rejectedBusId.includes(bus.id) == false){
            passenger.state = WAITING;
          }
        }
      }
    break;
    case ONBOARD:
      if (hasArrived){
        for (var i=0;i< buses.length;i++){
          var bus = buses[i];
          if (bus.id == passenger.busId){
            if (bus.location.col == stop3.col){
              passenger.state = DISAPPEAR;
              var timeInBusStop = currentTime - passenger.timeAdmitted;
              statistics[2].cumulativeValue = statistics[2].cumulativeValue + timeInBusStop;
              statistics[2].count = statistics[2].count + 1;
            }
          }
        }
      }
    break;
    case DISAPPEAR:
      passenger.state = EXITED;
    break;
    default:
    break;
  }

//------------------------------------------------------------------------------------------------
  // set the destination row and columns
  var targetRow = passenger.target.row;
  var targetCol = passenger.target.col;
  // compute the distance to the target destination
  var rowsToGo = targetRow-row;
  var colsToGo = targetCol-col;
  // set the speed
  var cellsPerStep = 1;
  // compute the cell to move to
  var newRow = row+Math.min(Math.abs(rowsToGo),cellsPerStep)*Math.sign(rowsToGo);
	var newCol = col + Math.min(Math.abs(colsToGo),cellsPerStep)*Math.sign(colsToGo);
  // update the location of the passenger
  passenger.location.row = newRow;
  passenger.location.col = newCol;
}

function removeDynamicAgents(){
  // image of passengers will disappear once he is onboard
  // remove the image of passengers whose have boarded on bus
  var allpassenger_1 = surface.selectAll(".passenger_1").data(passenger_1);
  var travelpassenger_1 = allpassenger_1.filter(function(d,i){return d.state==EXITED;});
  travelpassenger_1.remove();
  // Remove the EXITED passengers from the passenger list using a filter command
  passenger_1 = passenger_1.filter(function(d){return d.state != EXITED});

  var allpassenger_2 = surface.selectAll(".passenger_2").data(passenger_2);
  var travelpassenger_2 = allpassenger_2.filter(function(d,i){return d.state==EXITED;});
  travelpassenger_2.remove();
  // Remove the EXITED passengers from the passenger list using a filter command
  passenger_2 = passenger_2.filter(function(d){return d.state != EXITED});

  var allpassenger_3 = surface.selectAll(".passenger_3").data(passenger_3);
  var travelpassenger_3 = allpassenger_3.filter(function(d,i){return d.state==EXITED;});
  travelpassenger_3.remove();
  // Remove the EXITED passengers from the passenger list using a filter command
  passenger_3 = passenger_3.filter(function(d){return d.state != EXITED});

  // remove the image of bus once it reaches the bus interchange
  var allbuses = surface.selectAll(".buses").data(buses);
  var terminatedbuses = allbuses.filter(function(d,i){return d.state==EXITED;});
  // Remove the EXITED buses from the buses list using a filter command
  terminatedbuses.remove();
  buses = buses.filter(function(d){return d.state!=EXITED;});
}


function updateDynamicAgents(){
	// loop over all the agents and update their states
  for (var passengerIndex in passenger_1){
    updatePassenger_1(passengerIndex);
  }
  for (var passengerIndex in passenger_2){
    updatePassenger_2(passengerIndex);
  }
  for (var passengerIndex in passenger_3){
    updatePassenger_3(passengerIndex);
  }

  for (var busIndex in buses){
    updateBus(busIndex);
  }

	updateSurface();
}

function simStep(){
	//This function is called by a timer; if running, it executes one simulation step
	//The timing interval is set in the page initialization function near the top of this file
	if (isRunning){ //the isRunning variable is toggled by toggleSimStep
		// Increment current time (for computing statistics)
		currentTime++;
    // To show current simulation time
    statistics[3].cumulativeValue = currentTime++;
		// Sometimes new agents will be created in the following function
		addDynamicAgents();
		// In the next function we update each agent
		updateDynamicAgents();
		// Sometimes agents will be removed in the following function
		removeDynamicAgents();

	}
}
