// ==UserScript==
// @name         Nutmeg
// @namespace    http://www.galloway.me.uk/
// @version      0.1
// @description  Augment Nutmeg portfolio page
// @author       Matt Galloway
// @match        https://app.nutmeg.com/client/portfolio
// @match        https://app.nutmeg.com/client/portfolio/dig_deeper
// @updateURL    https://raw.githubusercontent.com/mattjgalloway/nutmeg-tampermonkey/master/nutmeg.user.js
// @downloadURL  https://raw.githubusercontent.com/mattjgalloway/nutmeg-tampermonkey/master/nutmeg.user.js
// @grant        none
// ==/UserScript==

installAnnualisedRate();

// Converts an array of arrays in [key, value] form, to a dictionary
function dataArrayToDictionary(dataArray) {
    var dictionary = {};
    for(i = 0; i < dataArray.length; i++) {
        var value = dataArray[i];
        dictionary[value[0]] = value[1];
    }
    return dictionary;
}

function calculateAnnualisedRateSeries(data) {
	var fundValues = data.performance;
	var contributions = data.contributions;

    // This will contain all of the data points as an array of arrays in the form [date, fundValue, contributions]
    var zippedData = [];
    var contributionsDictionary = dataArrayToDictionary(contributions);
    var lastDate = 0;
	for (i = 0; i < fundValues.length; i++) {
        fundValue = fundValues[i];
        date = fundValue[0];
        fundValueToday = fundValue[1];
        contributionsToday = contributionsDictionary[date];

		// Check it's the next day
		if (lastDate !== 0 && date != lastDate + 86400000) {
            // If it isn't the next day, let's start our array again
            // This must be consecutive days for the maths to work
			zippedData = [];
		}
		lastDate = date;

        zippedData.push([date, fundValueToday, contributionsToday]);
	}

	var summedContribution = 0;
	var dataRows = [];

	for (i = 0; i < zippedData.length; i++) {
		thisData = zippedData[i];

        date = thisData[0];
		fundValueToday = thisData[1];
		contributionsToday = thisData[2];

		summedContribution += contributionsToday;

		dailyPct = 100 * (Math.pow((1 + (fundValueToday - contributionsToday) / summedContribution), 365.25) - 1);

		dataRows.push([date, dailyPct]);
	}

	return dataRows;
}

function installAnnualisedRate() {
	var originalPerformanceChart = window.PerformanceChart;

	var originalMethod = originalPerformanceChart.prototype.chart_config;
	var newMethod = function(a, b, c){
		console.log('starting');

		var dataRows = calculateAnnualisedRateSeries(b);

		console.log('finished with data:');
		console.log(dataRows);

		var output = originalMethod(a, b, c);

        // Add a new series to the chart to show the annualised rate
		var newSeries = {
			threshold: null ,
			type: "area",
			name: "Annualised Rate",
			connectNulls: !1,
			data: dataRows,
			marker: {
				fillColor: "white",
				symbol: "circle",
				lineColor: "#ff0000",
				lineWidth: 1
			},
			lineColor: "#ff0000",
			fillColor: "rgba(255, 0, 0, 0.2)"
		};
		output.series.push(newSeries);

		// Replace the tooltip for hover with one that adds the annualised rate
		var tooltip = output.tooltip;
		var originalFormatter = tooltip.formatter;
		var newFormatter = function() {
			var originalTooltip = originalFormatter.call(this);
			var i = this.points.length - 1;
			return originalTooltip + "<br/>" + "Annualised Rate: " + this.points[i].y.toFixed(2) + "%";
		};
		tooltip.formatter = newFormatter;

		var chart = $('#' + a)[0];
		var closestChartData = chart.closest('[id^="charts-data-"]');

		var latestAnnualisedRate = "Latest annualised rate = " + dataRows[dataRows.length-1][1].toFixed(2) + "%";
		var textNode = document.createTextNode(latestAnnualisedRate);
		closestChartData.parentNode.insertBefore(textNode, closestChartData);

		return output;
	};

    // Swizzle the chart_config method to our new one
	originalPerformanceChart.prototype.chart_config = function(a, b, c) {
		try {
			return newMethod(a, b, c);
		} catch (error) {
			console.log(error + "\nBut continuing with old behaviour.");
			return originalMethod(a, b, c);
		}
	};
}
