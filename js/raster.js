(function () {
    ruleRaster = {};
	var width, height,
		chart, svg,
		defs, style;
	ruleRaster.init = function (params) {
		if (!params) {params = {}; }
		chart = d3.select(params.chart || "#chart"); // placeholder div for svg
		var margin = {top: 40, right: 30, bottom: 40, left: 120};
		var padding = {top: 60, right: 60, bottom: 60, left: 60};
		var outerWidth = params.width || 960,
			outerHeight = params.height || 500,
			innerWidth = outerWidth - margin.left - margin.right,
			innerHeight = outerHeight - margin.top - margin.bottom;
		width = innerWidth - padding.left - padding.right;
		height = innerHeight - padding.top - padding.bottom;
		chart.selectAll("svg")
			.data([{width: width + margin.left + margin.right, height: height + margin.top + margin.bottom}])
			.enter()
			.append("svg");
		svg = d3.select("svg").attr({
			width: function (d) {return d.width + margin.left + margin.right; },
			height: function (d) {return d.height + margin.top + margin.bottom; }
		})
			.append("g")
			.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
		// ruleRaster.init can be re-ran to pass different height/width values
		// to the svg. this doesn't create new svg elements.
		style = svg.selectAll("style").data([{}]).enter()
			.append("style")
			.attr("type", "text/css");
		// this is where we can insert style that will affect the svg directly.
		defs = svg.selectAll("defs").data([{}]).enter()
			.append("defs");
		// Create neuron file menu
		var fileNames = ["cc1", "isa9"];
		var fileMenu = d3.selectAll("#fileMenu")
			.append("select")
			.attr("name", "file-list");
		var options = fileMenu.selectAll("option")
			.data(fileNames)
			.enter()
			.append("option");
		fileMenu.select("option")
						.attr("selected", "selected");
		options.text(String)
				.attr("value", String);
		// Load Data
		ruleRaster.loadData(params);
	};
	ruleRaster.loadData = function (params) {
		if (!params) {params = {}; }
		d3.text(params.style || "style.txt", function (error, txt) {
			// note that execution won't be stopped if a style file isn't found
			style.text(txt); // but if found, it can be embedded in the svg.
			// ("#" + Math.random()) makes sure the script loads the file each time instead of using a cached version, remove once live
			var curFileName = "DATA/" + params.data  + ".json" + "#" + Math.random();
			d3.json(curFileName, function (error, json) {

        // Downsample if too many trials
        if (json[params.data].neurons[0].Number_of_Trials > 2000) {
          json[params.data].trials = json[params.data].trials.filter(function(d) {
            return Math.random() > 0.7;
          })
        };

				ruleRaster.data = json;
				// populate drop-down menu with neuron names
				var neuronMenu = d3.select("#neuronMenu");
				neuronMenu.selectAll("select.main")
						.data([{}])
						.enter()
						      .append("select")
						            .attr("name", "neuron-list")
						            .classed("main", 1);
				var	neuron = ruleRaster.data[params.data].neurons,
					options = neuronMenu.select("select").selectAll("option")
						.data(neuron, function(d) {return d.Name;});
				options.enter()
					.append("option")
					     .text(function (d) { return d.Name; })
					     .attr("value", function (d) { return d.Name; });
				options.exit().remove();
				neuronMenu // add option to select neuron based on parameters from the browser
						.select("select")
						.select("option")
						.attr("selected", "selected");

				// Draw visualization

				ruleRaster.draw(params);
			});
		});
	};
	ruleRaster.draw = function (params) {
		// Extract relevant trial and neuron information
		var neuronMenu = d3.select("#neuronMenu select"),
			curNeuronName = neuronMenu.property("value"),
			timeMenu = d3.select("#timeMenu select"),
			timeMenuValue = timeMenu.property("value"),
      fileMenu = d3.selectAll("#fileMenu"),
			factorSortMenu = d3.select("#factorSortMenu select"),
			factorSortMenuValue = factorSortMenu.property("value"),
			neuron = ruleRaster.data[params.data].neurons
                .filter(function (d) {
                    return d.Name === curNeuronName;
            });
		// Nest and Sort Data
		var factor = d3.nest()
				.key(function(d) {return d[factorSortMenuValue];}) // nests data by selected factor
      			.sortValues(function (a, b) { // sorts data based on Rule
					         return d3.ascending(a["Rule"], b["Rule"]);
				             })
      	.entries(ruleRaster.data[params.data].trials);
    // Compute variables for placing plots (plots maintain constant size for each trial)
    var factorLength = factor.map(function(d) {return d.values.length;});
    var factorRangeBand = factorLength.map(function(d) {return height * (d/d3.sum(factorLength))});
    var factorPoints = [0];
    factorRangeBand.forEach(function(d,i) {
      factorPoints[i+1] = factorPoints[i] + d;
    });
    factorPoints = factorPoints.slice(0, factorPoints.length-1);

    // Create a group element for each rule so that we can have two plots, translate plots so that they don't overlap
		var plotG = svg.selectAll("g.plotG")
          .data(factor, function(d) {return d.key;});
    plotG.exit()
          .remove();
		plotG.enter()
  				.append("g")
  				.attr("class", "plotG")
          .attr("id", function(d) {return d.key;});
    plotG.attr("transform", function(d, i) {
          return "translate(0," + factorPoints[i] + ")";
        });
   // Append a y-scale to each plot so that the scale is adaptive to the range of each plot
   plotG
  			.each(function(d,i) {
  				d.yScale = d3.scale.ordinal()
					             .domain(d3.range(d.values.length))
					             .rangeBands([0, factorRangeBand[i]]);
  			});

		// Set up x-scale, colorScale to be the same for both plots
		var	minTime = d3.min(ruleRaster.data[params.data].trials, function (d) {
				return d3.min(d[curNeuronName], function (e) { return d3.min(e); })  - d[timeMenuValue];
			}),
			maxTime = d3.max(ruleRaster.data[params.data].trials, function (d) {
				return d3.max(d[curNeuronName], function (e) { return d3.max(e); }) - d[timeMenuValue];
			}),
			xScale = d3.scale.linear()
					.domain([minTime-10, maxTime+10])
					.range([0, width]);

		var	colorScale = colorPicker();

        // Draw spikes, event lines, axes
        updateNeuralInfo();
        plotG.each(drawEventLines);
        plotG.each(drawSpikes);
        appendAxis();

        // Add labels to each plot
        ruleColorScale = d3.scale.ordinal()
            .domain(["Color", "Orientation"])
            .range(["#ef8a62","#67a9cf"]);

		// Listen for changes on the drop-down menu
		factorSortMenu
			.on("change", function () {
        svg.selectAll(".eventLine").remove();
				ruleRaster.draw(params);
			});
		neuronMenu
			.on("change", function () {
				ruleRaster.draw(params);
			});
		timeMenu
			.on("change", function () {
				ruleRaster.draw(params);
			});
    fileMenu
			.on("change", function () {
        svg.selectAll(".eventLine").remove();
				params.data = d3.selectAll("#fileMenu select").property("value"),
				ruleRaster.loadData(params);
			});

// ******************** Helper Functions **********************

// ******************** Draw Spikes Function ******************
        function drawSpikes(data, ind) {
            var curPlot = d3.select(this);

            // Join the trial data to svg containers ("g")
            var	trialG = curPlot.selectAll(".trial")
                  .data(data.values, function(d) {return d.trial_id; });
            // Remove trials that don't have matched data
            trialG.exit()
                  .remove();
            // For each new data, append an svg container and set css class to trial
            // for each group, translate its location to its index location in the trial object
            trialG.enter()
                .append("g")
                  .attr("class", "trial")
                  .attr("transform", function(d, i) {
                      return "translate(0," + data.yScale(i) + ")";
                  });
            trialG
                .style("fill", function (d) {
                    return colorScale(d["Rule"]);
                })
                .transition()
                  .duration(1000)
                .attr("transform", function(d, i) {
                    return "translate(0," + data.yScale(i) + ")";
                });
            // For each new spike time, append circles that correspond to the spike times
            // Set the x-position of the circles to their spike time and the y-position to the size of the ordinal scale range band
            // that way the translate can move them to their appropriate position relative to the same coordinate system
            var spikes = trialG.selectAll("circle.spikes")
                .data(function (d) { return d[curNeuronName]; });
            spikes.exit()
              .transition()
                .duration(1000)
              .style("opacity", 1E-5)
              .remove();
            spikes.enter()
                .append("circle")
                  .attr("class", "spikes")
                  .style("opacity", 1E-5);
            spikes
                .transition()
                  .duration(1000)
                .attr("cx", function (d) {
                    return xScale(d - (this.parentNode.__data__[timeMenuValue]));
                })
                .style("opacity", 0.9)
                .attr("r", data.yScale.rangeBand())
                .attr("cy", data.yScale.rangeBand() / 2);
            // Y axis labels
            var yAxisG = curPlot.selectAll("g.yAxis")
                .data([data.key]);
            yAxisG.enter()
                .append("g")
                .attr("class", "yAxis");
            yAxisG.exit()
                .remove();
            var yAxis = d3.svg.axis()
                    .scale(data.yScale)
                    .orient("left")
                    .tickValues(data.yScale.domain().filter(function(d, i) {
                      return false;
                    }));
            yAxisG
              .call(yAxis);
            yAxisLabel = yAxisG.selectAll("text.yLabel")
              .data([factorSortMenuValue + " " + data.key]);
            if (factorLength.length < 13) {
                yAxisLabel.enter()
                  .append("text")
                  .attr("class", "yLabel");
                yAxisLabel
                  .attr("x", 0)
                  .attr("dx", -0.4 + "em")
                  .attr("y", factorRangeBand[ind]/2)
                  .attr("text-anchor", "end")
                  .text(function(d) {return d;})
            }


        }
// ******************** Event Line Function *******************
        function drawEventLines(data, ind) {
            var curPlot = d3.select(this),
                lines = [
                    {label: "Rule Cue", id: "rule_onset"},
                    {label: "Test Stimulus Cue", id: "stim_onset"},
                    {label: "Saccade", id: "react_time"}
                ],
                eventLine = curPlot.selectAll("path.eventLine")
                    .data(lines, function(d) {return d.id;});
                eventLine.exit()
                    .remove();
            // Append mean times for label position
            lines = lines.map(function(line) {
                return {
                    label: line.label,
                    id: line.id,
                    mean_stat: d3.mean(data.values.map(function(d) {
                        return d[line.id] - d[timeMenuValue];
                    }))
                };
            });

            var valuesInd = d3.range(data.values.length);
            var newValues = data.values.concat(data.values);
            valuesInd = valuesInd.concat(valuesInd);
            newValues = newValues.map(function(d,i){
              d.sortInd = valuesInd[i];
              return d;
            });
            newValues.sort(function (a, b) {
                   return d3.ascending(a["sortInd"], b["sortInd"]);
                 });
            // Plot lines corresponding to trial events
            eventLine.enter()
                .append("path")
                  .attr("class", "eventLine")
                  .attr("id", function(d) {return d.id;})
                  .attr("opacity", 1E-6);

            eventLine
                .transition()
                  .duration(1000)
                  .ease("linear")
                .attr("opacity", 1.0)
                .attr("d", function(line) {
                        return LineFun(newValues, line.id);
                });

            // Add labels corresponding to trial events
            var eventLabel = svg.selectAll(".eventLabel")
                .data(lines, function(d) {return d.id;});

            if (ind == 0){

                eventLabel.enter()
                    .append("text")
                      .attr("class", "eventLabel")
                      .attr("id", function(d) {return d.id;})
                      .attr("y", 0)
                      .attr("dy", "-0.25em")
                      .attr("text-anchor", "middle")
                      .text(function(d) {return d.label; });


                eventLabel
                    .transition()
                      .duration(1000)
                      .ease("linear")
                    .attr("x", function(d) {
                            return xScale(d.mean_stat);
                    });
            }

            function LineFun(values, lineName) {

                // Setup helper line function
                 var line = d3.svg.line()
                    .x(function (d) {
                        return xScale(d[lineName] - d[timeMenuValue]);
                    })
                    .y(function (d, i) {
                      if (i % 2 == 0) {
                        return data.yScale(d.sortInd);
                      } else {
                        return data.yScale(d.sortInd) + data.yScale.rangeBand();
                      }

                      })
                    .interpolate("linear");

                return line(values);
            }
        }
// ******************** Axis Function *******************
        function appendAxis() {

            var xAxis = d3.svg.axis()
                    .scale(xScale)
                    .orient("bottom");
            // Append the x-axis
            var axisG = svg.selectAll("g.xAxis").data([{}]);
            axisG.enter()
                .append("g")
                .attr("class", "xAxis")
                .attr("transform", "translate(0, " + height + ")");
            axisG
              .transition()
                .duration(10)
                  .ease("linear")
              .call(xAxis);
        }
// ******************** Color Scale Function *******************
            function colorPicker() {
                switch ("Rule") {
                    case "trial_id":
                    case "stim_onset":
                        colorScale = d3.scale.ordinal()
                            .domain(0)
                            .range(["black"]);
                        break;
                    case "Rule":
                        colorScale = d3.scale.ordinal()
                            .domain(["Color", "Orientation"])
                            .range(["#ef8a62","#67a9cf"]);
                        break;
                    case "ResponseDir":
                        colorScale = d3.scale.ordinal()
                            .domain(["Left", "Right"])
                            .range(["red", "green"]);
                        break;
                    case "SwitchDist":
                        // can build a continuous color scale
                        colorScale = d3.scale.ordinal()
                            .domain(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"])
                            .range(colorbrewer.Paired["12"]);
                        break;
                }
                    return colorScale;
            }
// ******************** Neuron Info Function *******************
            function updateNeuralInfo() {
                var atGlance = d3.select("#atGlance").selectAll("table")
                    .data(neuron, function (d) {return d.Name;});
                // Display neuron info
                atGlance.enter()
                        .append("table")
                        .append("tbody");
                var tbody = atGlance.selectAll("tbody");
                var tr = tbody
                    .selectAll("tr")
                    .data(d3.keys(neuron[0]), String);
                tr.enter()
                    .append("tr")
                    .append("th")
                    .text(String);
                tr.selectAll("td")
                    .data(function (d) {
                        return neuron.map(function(column) {
                            return {key: d, value: column[d]};
                        });
                    })
                    .enter()
                      .append("td")
                      .text(function(d) { return d.value; });
                atGlance.exit()
                  .remove();
            }
	};
})();
