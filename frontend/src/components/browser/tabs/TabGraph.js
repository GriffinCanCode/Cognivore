/**
 * TabGraph.js - Renders an interactive visualization of tab relationships
 * 
 * This component uses D3.js to create a force-directed graph visualization
 * of tabs and their relationships. Shows both inter-group and intra-group relationships,
 * similarity strengths, clustering patterns, and provides analytical insights.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';

const TabGraph = ({ tabs, groups, relationships, activeTabId, onTabClick, onGroupClick }) => {
  const svgRef = useRef(null);
  const graphContainerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  
  // Calculate analytics data
  const analytics = useMemo(() => {
    if (!tabs || !groups || !relationships) return null;
    
    const totalTabs = tabs.length;
    const totalGroups = groups.length;
    const avgGroupSize = totalTabs / totalGroups;
    
    // Calculate relationship statistics
    const allRelationships = Object.values(relationships).flat();
    const totalRelationships = allRelationships.length;
    const avgSimilarity = allRelationships.length > 0 
      ? allRelationships.reduce((sum, rel) => sum + rel.similarity, 0) / allRelationships.length 
      : 0;
    
    // Find most connected tabs
    const connectionCounts = {};
    Object.entries(relationships).forEach(([tabId, rels]) => {
      connectionCounts[tabId] = rels.length;
    });
    
    const mostConnected = Object.entries(connectionCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([tabId, count]) => {
        const tab = tabs.find(t => t.id === tabId);
        return { tab, connections: count };
      });
    
    // Group analysis
    const groupAnalysis = groups.map(group => {
      const groupTabs = tabs.filter(tab => group.tabIds.includes(tab.id));
      const groupRelationships = groupTabs.reduce((total, tab) => {
        const tabRels = relationships[tab.id] || [];
        return total + tabRels.filter(rel => group.tabIds.includes(rel.tabId)).length;
      }, 0);
      
      return {
        ...group,
        size: group.tabIds.length,
        density: groupTabs.length > 1 ? groupRelationships / (groupTabs.length * (groupTabs.length - 1)) : 0,
        avgSimilarity: groupTabs.length > 1 ? 
          groupTabs.reduce((sum, tab) => {
            const tabRels = relationships[tab.id] || [];
            const groupRels = tabRels.filter(rel => group.tabIds.includes(rel.tabId));
            return sum + (groupRels.length > 0 ? groupRels.reduce((s, r) => s + r.similarity, 0) / groupRels.length : 0);
          }, 0) / groupTabs.length : 0
      };
    });
    
    return {
      totalTabs,
      totalGroups,
      avgGroupSize: Math.round(avgGroupSize * 10) / 10,
      totalRelationships,
      avgSimilarity: Math.round(avgSimilarity * 100) / 100,
      mostConnected,
      groupAnalysis: groupAnalysis.sort((a, b) => b.density - a.density)
    };
  }, [tabs, groups, relationships]);
  
  // Update dimensions when container size changes
  useEffect(() => {
    if (!graphContainerRef.current) return;
    
    const resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    
    resizeObserver.observe(graphContainerRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);
  
  // Render graph whenever dependencies change
  useEffect(() => {
    if (!svgRef.current || tabs.length === 0 || !dimensions.width) return;
    
    // Add a small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      try {
        renderGraph();
      } catch (error) {
        console.error('Error rendering graph:', error);
      }
    }, 10);
    
    return () => clearTimeout(timeoutId);
  }, [tabs, groups, relationships, activeTabId, dimensions, collapsedGroups, hoveredNode, selectedNode]);
  
  const renderGraph = () => {
    // Safety checks
    if (!svgRef.current || !tabs || !groups || tabs.length === 0 || !dimensions.width || !dimensions.height) {
      console.warn('TabGraph: Missing required data for rendering');
      return;
    }
    
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    
    const width = dimensions.width;
    const height = dimensions.height;
    
    // Create scale for node sizing based on connections
    const connectionCounts = {};
    Object.entries(relationships || {}).forEach(([tabId, rels]) => {
      connectionCounts[tabId] = rels.length;
    });
    
    const maxConnections = Math.max(...Object.values(connectionCounts), 1);
    const nodeScale = d3.scaleLinear()
      .domain([0, maxConnections])
      .range([12, 28]);
    
    // Prepare data for D3 visualization
    const nodesData = [];
    const linksData = [];
    
    // Process groups and determine which nodes to show
    groups.forEach(group => {
      const isCollapsed = collapsedGroups[group.id];
      
      if (isCollapsed) {
        // Add a single node for the collapsed group
        const groupConnections = group.tabIds.reduce((total, tabId) => {
          return total + (connectionCounts[tabId] || 0);
        }, 0);
        
        nodesData.push({
          id: `group-${group.id}`,
          type: 'group',
          label: group.name || `Group ${group.id}`,
          color: group.color || '#64748b',
          size: Math.max(32, nodeScale(groupConnections)),
          group: group.id,
          tabIds: group.tabIds,
          connections: groupConnections,
          density: analytics?.groupAnalysis.find(g => g.id === group.id)?.density || 0
        });
      } else {
        // Add individual nodes for tabs in this group
        group.tabIds.forEach(tabId => {
          const tab = tabs.find(t => t.id === tabId);
          if (tab) {
            const tabConnections = connectionCounts[tabId] || 0;
            nodesData.push({
              id: tab.id,
              type: 'tab',
              label: tab.title || tab.url,
              url: tab.url,
              favicon: tab.favicon,
              color: group.color || '#64748b',
              size: Math.max(16, nodeScale(tabConnections)),
              group: group.id,
              groupName: group.name,
              isActive: tab.id === activeTabId,
              isHovered: hoveredNode === tab.id,
              isSelected: selectedNode === tab.id,
              connections: tabConnections,
              category: group.category
            });
          }
        });
      }
    });
    
    // Create links based on relationships
    if (relationships) {
      Object.entries(relationships).forEach(([sourceTabId, rels]) => {
        rels.forEach(rel => {
          const sourceTab = tabs.find(t => t.id === sourceTabId);
          const targetTab = tabs.find(t => t.id === rel.tabId);
          
          if (!sourceTab || !targetTab) return;
          
          const sourceGroup = groups.find(g => g.tabIds.includes(sourceTabId));
          const targetGroup = groups.find(g => g.tabIds.includes(rel.tabId));
          
          // Check if both tabs are visible (not in collapsed groups)
          const sourceVisible = !collapsedGroups[sourceGroup?.id];
          const targetVisible = !collapsedGroups[targetGroup?.id];
          
          if (sourceVisible && targetVisible) {
            const isIntraGroup = sourceGroup?.id === targetGroup?.id;
            
            linksData.push({
              source: sourceTabId,
              target: rel.tabId,
              value: rel.similarity,
              strength: Math.max(0.3, rel.similarity * 1.2),
              isIntraGroup,
              sourceGroup: sourceGroup?.id,
              targetGroup: targetGroup?.id,
              type: isIntraGroup ? 'intra' : 'inter'
            });
          }
        });
      });
    }
    
    // Create D3 force simulation with enhanced forces
    const simulation = d3.forceSimulation(nodesData)
      .force("link", d3.forceLink(linksData)
        .id(d => d.id)
        .distance(d => {
          // Shorter distances for stronger relationships
          const baseDistance = d.isIntraGroup ? 100 : 150;
          return baseDistance - (d.strength * 50);
        })
        .strength(d => Math.max(0.4, d.strength || 0.5)))
      .force("charge", d3.forceManyBody()
        .strength(d => {
          // Stronger repulsion for highly connected nodes
          const baseStrength = d.type === 'group' ? -600 : -400;
          return baseStrength - (d.connections * 20);
        }))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(d => d.size + 20))
      .force("x", d3.forceX(width / 2).strength(0.08))
      .force("y", d3.forceY(height / 2).strength(0.08));
    
    // Create SVG elements
    const g = svg.append("g")
      .attr("class", "graph-group");
    
    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    
    svg.call(zoom)
      .call(zoom.transform, d3.zoomIdentity);
    
    // Add background
    svg.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .on("click", () => {
        setHoveredNode(null);
        setSelectedNode(null);
      });
    
    // Create gradients and filters
    const defs = svg.append("defs");
    
    // Glow filter for active/selected nodes
    const glowFilter = defs.append("filter")
      .attr("id", "glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    
    glowFilter.append("feGaussianBlur")
      .attr("stdDeviation", "3")
      .attr("result", "coloredBlur");
    
    const feMerge = glowFilter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    
    // Animated glow filter for link trails
    const trailGlowFilter = defs.append("filter")
      .attr("id", "trail-glow")
      .attr("x", "-100%")
      .attr("y", "-100%")
      .attr("width", "300%")
      .attr("height", "300%");
    
    trailGlowFilter.append("feGaussianBlur")
      .attr("stdDeviation", "4")
      .attr("result", "glowBlur");
    
    const trailMerge = trailGlowFilter.append("feMerge");
    trailMerge.append("feMergeNode").attr("in", "glowBlur");
    trailMerge.append("feMergeNode").attr("in", "SourceGraphic");
    
    // Create link gradients
    linksData.forEach((link, i) => {
      const gradientId = `link-gradient-${i}`;
      const gradient = defs.append("linearGradient")
        .attr("id", gradientId)
        .attr("gradientUnits", "userSpaceOnUse");
      
      gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", () => {
          const sourceNode = nodesData.find(n => n.id === link.source);
          return sourceNode ? sourceNode.color : "#999";
        });
      
      gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", () => {
          const targetNode = nodesData.find(n => n.id === link.target);
          return targetNode ? targetNode.color : "#999";
        });
      
      // Create animated trail gradient for ant-like movement
      const trailGradientId = `trail-gradient-${i}`;
      const trailGradient = defs.append("linearGradient")
        .attr("id", trailGradientId)
        .attr("gradientUnits", "userSpaceOnUse");
      
      // Create multiple stops for the moving glow effect
      trailGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "transparent")
        .attr("stop-opacity", "0");
      
      trailGradient.append("stop")
        .attr("offset", "40%")
        .attr("stop-color", "transparent")
        .attr("stop-opacity", "0");
      
      trailGradient.append("stop")
        .attr("offset", "50%")
        .attr("stop-color", () => {
          const colors = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b"];
          return colors[i % colors.length];
        })
        .attr("stop-opacity", "0.8");
      
      trailGradient.append("stop")
        .attr("offset", "60%")
        .attr("stop-color", "transparent")
        .attr("stop-opacity", "0");
      
      trailGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "transparent")
        .attr("stop-opacity", "0");
      
      // Animate the gradient offset to create moving effect
      const animateTransform = trailGradient.append("animateTransform")
        .attr("attributeName", "gradientTransform")
        .attr("type", "translate")
        .attr("values", "0,0; 100,0; 0,0")
        .attr("dur", `${3 + (i % 4)}s`) // Vary duration for different speeds
        .attr("repeatCount", "indefinite");
    });
    
    // Create links with enhanced styling
    const linkGroup = g.append("g").attr("class", "links");
    
    const link = linkGroup.selectAll("line")
      .data(linksData)
      .enter()
      .append("line")
      .attr("stroke-width", d => {
        if (!d) return 2;
        const baseWidth = d.isIntraGroup ? 3 : 2;
        return baseWidth + ((d.value || 0) * 4);
      })
      .attr("stroke", (d, i) => `url(#link-gradient-${i})`)
      .attr("stroke-opacity", d => d && d.isIntraGroup ? 0.9 : 0.6)
      .attr("stroke-linecap", "round")
      .attr("stroke-dasharray", d => d && d.isIntraGroup ? "none" : "5,5");
    
    // Add tooltips to links
    link.each(function(linkData) {
      d3.select(this).append("title")
        .text(`Similarity: ${(linkData.value * 100).toFixed(1)}% (${linkData.type || (linkData.isIntraGroup ? 'intra' : 'inter')}-group)`);
    });
    
    // Create animated trail links (ant-like movement) - only on random subset
    const trailLinkGroup = g.append("g").attr("class", "trail-links");
    
    // Select random subset of links for trail effect (about 30% of links)
    const trailLinksData = linksData.filter((d, i) => Math.random() < 0.3);
    
    const trailLink = trailLinkGroup.selectAll("line")
      .data(trailLinksData)
      .enter()
      .append("line")
      .attr("stroke-width", d => {
        if (!d) return 3;
        const baseWidth = d.isIntraGroup ? 4 : 3;
        return baseWidth + ((d.value || 0) * 2);
      })
      .attr("stroke", (d, i) => {
        // Find the original index in linksData for consistent gradient reference
        const originalIndex = linksData.findIndex(link => 
          link.source === d.source && link.target === d.target
        );
        return `url(#trail-gradient-${originalIndex})`;
      })
      .attr("stroke-opacity", "0.9")
      .attr("stroke-linecap", "round")
      .attr("filter", "url(#trail-glow)")
      .style("mix-blend-mode", "screen"); // Additive blending for glow effect
    
    // Add pulsing animation to trail links
    trailLink
      .style("animation", (d, i) => `trailPulse ${2 + (i % 3)}s ease-in-out infinite`)
      .style("animation-delay", (d, i) => `${i * 0.5}s`);
    
    // Add CSS animation for trail pulsing
    const style = document.createElement('style');
    style.textContent = `
      @keyframes trailPulse {
        0%, 100% { 
          stroke-opacity: 0.3;
          filter: url(#trail-glow) brightness(0.8);
        }
        50% { 
          stroke-opacity: 0.9;
          filter: url(#trail-glow) brightness(1.2);
        }
      }
    `;
    document.head.appendChild(style);
    
    // Create node containers
    const nodeGroup = g.append("g").attr("class", "nodes");
    
    const node = nodeGroup.selectAll(".node")
      .data(nodesData)
      .enter()
      .append("g")
      .attr("class", "node")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended))
      .on("click", handleNodeClick)
      .on("mouseover", (event, d) => {
        setHoveredNode(d.id);
        highlightConnections(d);
      })
      .on("mouseout", () => {
        setHoveredNode(null);
        resetHighlights();
      });
    
    // Add node highlight rings
    node.append("circle")
      .attr("r", d => d && d.size ? d.size + 8 : 16)
      .attr("fill", "none")
      .attr("stroke", d => d && d.color ? d.color : "#999")
      .attr("stroke-width", 3)
      .attr("stroke-opacity", d => d && d.isSelected ? 0.8 : 0)
      .attr("class", "node-highlight");
    
    // Add main node circles with enhanced styling
    node.append("circle")
      .attr("r", d => d && d.size ? d.size : 12)
      .attr("fill", d => {
        if (!d) return "#999";
        // Create a radial gradient effect
        const baseColor = d.color || "#999";
        return baseColor;
      })
      .attr("stroke", d => {
        if (!d) return "#333";
        if (d.isActive) return "#ffffff";
        if (d.isSelected) return "#fbbf24";
        if (d.isHovered) return "#ffffff";
        return "#333";
      })
      .attr("stroke-width", d => {
        if (!d) return 2;
        if (d.isActive) return 4;
        if (d.isSelected) return 3;
        if (d.isHovered) return 3;
        return 2;
      })
      .attr("filter", d => (d && (d.isActive || d.isSelected)) ? "url(#glow)" : "none")
      .attr("class", "node-circle")
      .style("box-shadow", "0 4px 12px rgba(0, 0, 0, 0.3)");
    
    // Add connection count indicators for highly connected nodes
    const highlyConnectedNodes = node.filter(d => d && d.connections && d.connections > 2);
    
    highlyConnectedNodes
      .append("circle")
      .attr("r", 10)
      .attr("cx", d => d && d.size ? d.size - 8 : 0)
      .attr("cy", d => d && d.size ? -d.size + 8 : 0)
      .attr("fill", "#ef4444")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);
    
    highlyConnectedNodes
      .append("text")
      .attr("x", d => d && d.size ? d.size - 8 : 0)
      .attr("y", d => d && d.size ? -d.size + 8 : 0)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .attr("fill", "white")
      .text(d => d && d.connections ? d.connections : 0);
    
    // Add type-specific content
    node.each(function(d) {
      const currentNode = d3.select(this);
      
      if (d.type === 'group') {
        // Group node content
        currentNode.append("text")
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .attr("font-family", "Arial, sans-serif")
          .attr("font-weight", "bold")
          .attr("font-size", "16px")
          .attr("fill", "#fff")
          .text("⚫");
        
        // Group info
        currentNode.append("text")
          .attr("text-anchor", "middle")
          .attr("y", d.size + 20)
          .attr("font-size", "12px")
          .attr("font-weight", "600")
          .attr("fill", "#fff")
          .attr("stroke", "#000")
          .attr("stroke-width", "0.5px")
          .attr("paint-order", "stroke")
          .text(`${d.tabIds.length} tabs`);
      } else if (d.favicon) {
        // Tab node with favicon - enhanced display
        currentNode.append("image")
          .attr("xlink:href", d.favicon)
          .attr("x", -10)
          .attr("y", -10)
          .attr("width", 20)
          .attr("height", 20)
          .attr("clip-path", "circle()")
          .style("filter", "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))");
      } else {
        // Tab node without favicon - enhanced icon
        currentNode.append("text")
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .attr("font-size", "16px")
          .attr("fill", "#fff")
          .attr("filter", "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5))")
          .text("📄");
      }
    });
    
    // Add enhanced labels
    node.append("text")
      .attr("text-anchor", "middle")
      .attr("y", d => d && d.size ? d.size + 20 : 28)
      .attr("font-family", "system-ui, -apple-system, sans-serif")
      .attr("font-size", "11px")
      .attr("font-weight", "500")
      .attr("fill", "#e2e8f0")
      .attr("stroke", "#000")
      .attr("stroke-width", "0.8px")
      .attr("paint-order", "stroke")
      .text(d => {
        if (!d) return "";
        if (d.type === 'group') return "";
        const label = d.label || "";
        return label.length > 30 ? label.substring(0, 27) + "..." : label;
      })
      .attr("opacity", d => (d && (d.isActive || d.isHovered || d.isSelected)) ? 1 : 0.8);
    
    // Add tooltips
    node.append("title")
      .text(d => {
        if (!d) return "Unknown node";
        if (d.type === 'group') {
          return `${d.label || 'Group'}\n${d.tabIds ? d.tabIds.length : 0} tabs\n${d.connections || 0} total connections\nDensity: ${d.density ? (d.density * 100).toFixed(1) : 0}%`;
        } else {
          return `${d.label || 'Tab'}\n${d.url || ''}\nGroup: ${d.groupName || 'None'}\nConnections: ${d.connections || 0}`;
        }
      });
    
    // Highlight connections function
    function highlightConnections(d) {
      // Highlight connected links with enhanced visual effects
      linkGroup.selectAll("line")
        .attr("stroke-opacity", l => 
          (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.15
        )
        .attr("stroke-width", l => {
          if (l.source.id === d.id || l.target.id === d.id) {
            const baseWidth = l.isIntraGroup ? 4 : 3;
            return baseWidth + (l.value * 5);
          }
          return 1;
        })
        .style("filter", l => 
          (l.source.id === d.id || l.target.id === d.id) ? 
          "drop-shadow(0 0 6px rgba(59, 130, 246, 0.6))" : "none"
        );
      
      // Highlight connected trail links
      trailLinkGroup.selectAll("line")
        .attr("stroke-opacity", l => 
          (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.1
        )
        .style("filter", l => {
          if (l.source.id === d.id || l.target.id === d.id) {
            return "url(#trail-glow) brightness(1.5) drop-shadow(0 0 8px rgba(59, 130, 246, 0.8))";
          }
          return "url(#trail-glow) brightness(0.5)";
        })
        .style("animation", l => {
          if (l.source.id === d.id || l.target.id === d.id) {
            return "trailPulse 1s ease-in-out infinite"; // Faster pulse when highlighted
          }
          return "trailPulse 3s ease-in-out infinite"; // Normal pulse
        });
      
      // Highlight connected nodes with enhanced effects
      nodeGroup.selectAll(".node")
        .select(".node-circle")
        .attr("opacity", n => {
          if (n.id === d.id) return 1;
          const isConnected = linksData.some(l => 
            (l.source.id === d.id && l.target.id === n.id) ||
            (l.target.id === d.id && l.source.id === n.id)
          );
          return isConnected ? 1 : 0.3;
        })
        .style("filter", n => {
          if (n.id === d.id) return "drop-shadow(0 0 12px rgba(59, 130, 246, 0.8))";
          const isConnected = linksData.some(l => 
            (l.source.id === d.id && l.target.id === n.id) ||
            (l.target.id === d.id && l.source.id === n.id)
          );
          return isConnected ? "drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))" : "none";
        });
      
      // Enhance labels for connected nodes
      nodeGroup.selectAll(".node")
        .selectAll("text")
        .attr("opacity", n => {
          if (n.id === d.id) return 1;
          const isConnected = linksData.some(l => 
            (l.source.id === d.id && l.target.id === n.id) ||
            (l.target.id === d.id && l.source.id === n.id)
          );
          return isConnected ? 1 : 0.4;
        });
    }
    
    // Reset highlights function
    function resetHighlights() {
      linkGroup.selectAll("line")
        .attr("stroke-opacity", linkData => linkData.isIntraGroup ? 0.9 : 0.6)
        .attr("stroke-width", linkData => {
          const baseWidth = linkData.isIntraGroup ? 3 : 2;
          return baseWidth + (linkData.value * 4);
        })
        .style("filter", "none");
      
      // Reset trail links
      trailLinkGroup.selectAll("line")
        .attr("stroke-opacity", "0.9")
        .style("filter", "url(#trail-glow)")
        .style("animation", (d, i) => `trailPulse ${2 + (i % 3)}s ease-in-out infinite`);
      
      nodeGroup.selectAll(".node")
        .select(".node-circle")
        .attr("opacity", 1)
        .style("filter", d => (d && (d.isActive || d.isSelected)) ? "url(#glow)" : "none");
      
      nodeGroup.selectAll(".node")
        .selectAll("text")
        .attr("opacity", d => (d && (d.isActive || d.isHovered || d.isSelected)) ? 1 : 0.8);
    }
    
    // Handle node click
    function handleNodeClick(event, d) {
      event.preventDefault();
      event.stopPropagation();
      
      if (d.type === 'group') {
        setCollapsedGroups(prev => ({
          ...prev,
          [d.group]: !prev[d.group]
        }));
        
        if (onGroupClick) {
          onGroupClick(d.group);
        }
      } else {
        setSelectedNode(selectedNode === d.id ? null : d.id);
        
        if (onTabClick) {
          onTabClick(d.id);
        }
      }
    }
    
    // Drag functions
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
      d3.select(this).raise();
    }
    
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      setTimeout(() => {
        if (d) {
          d.fx = null;
          d.fy = null;
        }
      }, 1000);
    }
    
    // Update positions on tick
    simulation.on("tick", () => {
      // Constrain nodes to container
      nodesData.forEach(d => {
        d.x = Math.max(d.size + 10, Math.min(width - d.size - 10, d.x));
        d.y = Math.max(d.size + 10, Math.min(height - d.size - 10, d.y));
      });
      
      // Update regular links
      linkGroup.selectAll("line")
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
      
      // Update trail links
      trailLinkGroup.selectAll("line")
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y)
        .each(function(d, i) {
          // Update gradient coordinates for proper trail direction
          const originalIndex = linksData.findIndex(link => 
            link.source === d.source && link.target === d.target
          );
          const gradient = defs.select(`#trail-gradient-${originalIndex}`);
          if (!gradient.empty()) {
            gradient
              .attr("x1", d.source.x)
              .attr("y1", d.source.y)
              .attr("x2", d.target.x)
              .attr("y2", d.target.y);
          }
        });
      
      nodeGroup.selectAll(".node")
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });
  };
  
  return (
    <div className="tab-graph-container" ref={graphContainerRef} style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      {/* Subtle tech overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
          radial-gradient(circle at 10% 20%, rgba(59, 130, 246, 0.02) 0%, transparent 40%),
          radial-gradient(circle at 90% 80%, rgba(139, 92, 246, 0.015) 0%, transparent 40%),
          radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.01) 0%, transparent 60%)
        `,
        pointerEvents: 'none',
        zIndex: 1,
        animation: 'pulse 8s ease-in-out infinite alternate'
      }} />
      
      {/* Scanning line effect */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '-100%',
        width: '100%',
        height: '2px',
        background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.4), transparent)',
        animation: 'scanLine 12s linear infinite',
        pointerEvents: 'none',
        zIndex: 1
      }} />
      
      <svg ref={svgRef} width="100%" height="100%" style={{ position: 'relative', zIndex: 2 }}></svg>
      
      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 0.3; }
          100% { opacity: 0.6; }
        }
        
        @keyframes scanLine {
          0% { left: '-100%'; top: 10%; }
          25% { left: '100%'; top: 10%; }
          26% { left: '-100%'; top: 30%; }
          50% { left: '100%'; top: 30%; }
          51% { left: '-100%'; top: 60%; }
          75% { left: '100%'; top: 60%; }
          76% { left: '-100%'; top: 90%; }
          100% { left: '100%'; top: 90%; }
        }
      `}</style>
    </div>
  );
};

export default TabGraph; 