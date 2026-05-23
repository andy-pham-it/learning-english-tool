const fs = require('fs');
const path = require('path');

const existing = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'web', 'public', 'assets', 'data', 'patterns.json'), 'utf-8'
));

const vietMap = {
  Suggestions: "Đưa ra gợi ý",
  Clarification: "Yêu cầu làm rõ",
  Agreement: "Thể hiện sự đồng tình",
  Disagreement: "Bày tỏ ý kiến khác",
  'Status Updates': "Cập nhật tiến độ",
  Deadlines: "Trao đổi về thời hạn",
  Meeting: "Điều phối cuộc họp",
  Feedback: "Đưa ra phản hồi",
  Negotiation: "Đàm phán",
  'Problem Solving': "Giải quyết vấn đề",
  Apologizing: "Xin lỗi",
  Requests: "Yêu cầu hỗ trợ",
  'Small Talk': "Giao tiếp xã giao",
  Opinions: "Chia sẻ quan điểm",
  'Email & Writing': "Viết email công sở",
  Encouragement: "Động viên đồng nghiệp",
};

const contextMap = {
  Suggestions: "Khi bạn có ý tưởng nhưng muốn để nhóm cùng thảo luận và quyết định.",
  Clarification: "Khi bạn cần thêm thông tin để hiểu rõ vấn đề trước khi phản hồi.",
  Agreement: "Khi bạn muốn khẳng định sự đồng thuận và xây dựng tinh thần đội nhóm.",
  Disagreement: "Khi bạn có quan điểm khác nhưng muốn giữ bầu không khí tích cực.",
  'Status Updates': "Khi được hỏi về tình trạng công việc trong daily stand-up hoặc báo cáo.",
  Deadlines: "Khi cần thương lượng lại deadline hoặc xác nhận thời gian bàn giao.",
  Meeting: "Khi bạn chủ trì hoặc muốn đóng góp vào việc điều hướng cuộc họp.",
  Feedback: "Khi cần góp ý trong code review, performance review, hoặc sau một dự án.",
  Negotiation: "Khi thương lượng về ngân sách, thời gian, hoặc phạm vi công việc.",
  'Problem Solving': "Khi nhóm gặp khó khăn và cần một hướng giải quyết rõ ràng.",
  Apologizing: "Khi bạn hoặc nhóm mắc lỗi và cần khắc phục hậu quả một cách chuyên nghiệp.",
  Requests: "Khi bạn cần đồng nghiệp hỗ trợ hoặc cần thông tin để tiếp tục công việc.",
  'Small Talk': "Đầu cuộc họp, giờ nghỉ trưa, hoặc khi gặp đồng nghiệp ở hành lang.",
  Opinions: "Khi nhóm đang thảo luận và bạn muốn đóng góp ý kiến cá nhân.",
  'Email & Writing': "Khi gửi email cho đồng nghiệp, khách hàng, hoặc cấp trên.",
  Encouragement: "Khi đồng nghiệp gặp khó khăn, áp lực hoặc vừa hoàn thành tốt công việc.",
};

const categories = {
  Suggestions: [
    { pattern: "How about + verb-ing + ...?", structure: "How about {action}?", variables: { action: ["trying a different approach", "scheduling a follow-up", "reviewing the document together", "asking the client for feedback", "running a quick test"] } },
    { pattern: "What if we + verb (base form) + ...?", structure: "What if we {action} {target}?", variables: { action: ["try", "use", "implement", "consider", "explore"], target: ["a different strategy", "a new tool", "automation", "outsourcing", "A/B testing"] } },
    { pattern: "Maybe we could + verb (base form) + ...?", structure: "Maybe we could {action} {object}.", variables: { action: ["look into", "discuss", "postpone", "prioritize", "delegate"], object: ["this issue", "the alternatives", "the deadline", "the tasks", "the responsibilities"] } },
    { pattern: "One option would be to + verb (base form) + ...", structure: "One option would be to {action} {object}.", variables: { action: ["hire", "train", "outsource", "automate", "redesign"], object: ["a specialist", "the existing team", "this task", "the workflow", "the interface"] } },
    { pattern: "It might be worth + verb-ing + noun phrase to + verb + ...", structure: "It might be worth {action} to {purpose}.", variables: { action: ["checking", "verifying", "confirming", "reviewing", "testing"], purpose: ["avoid costly mistakes", "ensure accuracy", "save time later", "catch issues early", "improve quality"] } },
    { pattern: "I'd recommend + verb-ing + noun phrase instead of + verb-ing + noun phrase.", structure: "I'd recommend {recommendation} instead of {alternative}.", variables: { recommendation: ["using a more robust framework", "starting with a prototype", "doing more research first", "breaking it into phases", "automating this process"], alternative: ["building from scratch", "jumping straight in", "rushing the implementation", "doing it all at once", "doing it manually"] } },
    { pattern: "The way I see it, we could either + verb + noun phrase or + verb + noun phrase.", structure: "The way I see it, we could either {option_a} or {option_b}.", variables: { option_a: ["hire more developers", "outsource the work", "delay the launch", "reduce the scope", "use existing tools"], option_b: ["train existing staff", "do it in-house", "ship what we have", "increase resources", "build a custom solution"] } },
    { pattern: "Why don't we + verb + noun phrase + and see how it goes?", structure: "Why don't we {action} and see how it goes?", variables: { action: ["try this approach", "start with a small test", "run a pilot program", "ask for user feedback first", "implement the simplest version"] } },
    { pattern: "We could always fall back to + noun phrase if + noun phrase doesn't work out.", structure: "We could always fall back to {fallback} if {primary} doesn't work out.", variables: { fallback: ["the original plan", "the old system", "manual processing", "the previous vendor", "option B"], primary: ["this new approach", "the new system", "automation", "the new vendor", "option A"] } },
    { pattern: "Would it make sense to + verb + noun phrase before + verb-ing + noun phrase?", structure: "Would it make sense to {action} before {prerequisite}?", variables: { action: ["finalize the requirements", "get stakeholder approval", "complete the research", "build a prototype", "estimate the cost"], prerequisite: ["proceeding", "starting development", "making a decision", "committing resources", "moving forward"] } },
    { pattern: "Not to complicate things, but have we thought about + noun phrase?", structure: "Not to complicate things, but have we thought about {idea}?", variables: { idea: ["the long-term maintenance cost", "how this scales", "the security implications", "the impact on existing users", "an alternative architecture"] } },
  ],
  Clarification: [
    { pattern: "I'm not sure I follow. Could you explain + what/why/how + ...?", structure: "I'm not sure I follow. Could you explain {topic}?", variables: { topic: ["what you mean by that", "why this is important", "how this works", "what the next steps are", "how this affects the timeline"] } },
    { pattern: "Let me make sure I understand: you're saying + ...?", structure: "Let me make sure I understand: you're saying {point}?", variables: { point: ["we should delay the launch", "the budget needs to be revised", "the client wants a redesign", "we need more resources", "the deadline is flexible"] } },
    { pattern: "Could you walk me through + noun phrase + ...?", structure: "Could you walk me through {topic}?", variables: { topic: ["the process step by step", "how you arrived at this conclusion", "the implementation plan", "the reasoning behind this decision", "the proposed changes"] } },
    { pattern: "What exactly do you mean by + noun phrase?", structure: "What exactly do you mean by {phrase}?", variables: { phrase: ["optimizing the workflow", "restructuring the team", "agile transformation", "technical debt", "scaling the infrastructure"] } },
    { pattern: "Could you be more specific about + noun phrase?", structure: "Could you be more specific about {topic}?", variables: { topic: ["what part of the system is affected", "when you expect to be done", "which team will handle this", "how much budget we're talking about", "what success looks like"] } },
    { pattern: "When you say + noun phrase, are you referring to + noun phrase or + noun phrase?", structure: "When you say {phrase}, are you referring to {option_a} or {option_b}?", variables: { phrase: ["restructuring", "migration", "the new system", "optimization", "automation"], option_a: ["the team structure", "database migration", "the CRM tool", "performance optimization", "test automation"], option_b: ["the code structure", "cloud migration", "the analytics tool", "cost optimization", "deployment automation"] } },
    { pattern: "Sorry, I'm not quite with you. Could you rephrase that?", structure: "Sorry, I'm not quite with you. Could you rephrase that {context}?", variables: { context: ["in simpler terms", "with an example", "from a different angle", "step by step", "for a non-technical audience"] } },
    { pattern: "So just to confirm, + clause?", structure: "So just to confirm, {confirmation}?", variables: { confirmation: ["we're aiming for a Friday release", "the budget has been approved", "I'm responsible for the frontend", "the meeting has been moved to Tuesday", "the client signed off on the design"] } },
  ],
  Agreement: [
    { pattern: "That's a great point. I also think + subject + should + verb + ...", structure: "That's a great point. I also think {subject} {action}.", variables: { subject: ["we", "the team", "management", "everyone"], action: ["should consider this", "needs to prioritize this", "should act on this soon", "would benefit from this", "needs to be aligned on this"] } },
    { pattern: "I couldn't agree more. + subject + is definitely + adjective + ...", structure: "I couldn't agree more. {subject} is definitely {adjective}.", variables: { subject: ["This approach", "The current plan", "Your suggestion", "The proposal", "This strategy"], adjective: ["the right way to go", "worth pursuing", "well thought out", "what we need right now", "a game changer"] } },
    { pattern: "You make a valid point. I hadn't thought about + noun phrase that way.", structure: "You make a valid point. I hadn't thought about {topic} that way.", variables: { topic: ["the timeline", "the budget constraints", "user adoption", "the integration challenges", "the resource allocation"] } },
    { pattern: "I'm on board with + noun phrase. Let's go ahead with that.", structure: "I'm on board with {decision}. Let's go ahead with that.", variables: { decision: ["this proposal", "the new direction", "the suggested changes", "the revised timeline", "the reallocation of resources"] } },
    { pattern: "That aligns with what I was thinking. + noun phrase is definitely the way to go.", structure: "That aligns with what I was thinking. {decision} is definitely the way to go.", variables: { decision: ["This approach", "The new strategy", "The proposed solution", "The revised plan", "The current direction"] } },
    { pattern: "Absolutely, I second + noun phrase.", structure: "Absolutely, I second {suggestion}.", variables: { suggestion: ["that proposal", "the motion", "that idea", "the recommendation", "that approach"] } },
  ],
  Disagreement: [
    { pattern: "I see your point, but have we considered + noun phrase?", structure: "I see your point, but have we considered {consideration}?", variables: { consideration: ["the potential risks", "the long-term costs", "the impact on other teams", "an alternative solution", "the feedback from stakeholders"] } },
    { pattern: "I understand where you're coming from, but my concern is + that clause.", structure: "I understand where you're coming from, but my concern is {concern}.", variables: { concern: ["that we might be rushing this", "that the timeline is too aggressive", "that we're missing the bigger picture", "that this could set a bad precedent", "that we haven't tested this enough"] } },
    { pattern: "I respectfully disagree. In my experience, + clause.", structure: "I respectfully disagree. In my experience, {experience}.", variables: { experience: ["this approach doesn't scale well", "rushing leads to mistakes", "communication is the key", "simpler solutions work better", "involving the team early prevents issues"] } },
    { pattern: "I'm not entirely convinced that + clause. What evidence do we have?", structure: "I'm not entirely convinced that {statement}. What evidence do we have?", variables: { statement: ["this is the right approach", "we can deliver on time", "the client will accept this", "the benefits outweigh the costs", "we have the necessary skills"] } },
    { pattern: "While I see the benefits, I'm worried about + noun phrase.", structure: "While I see the benefits, I'm worried about {concern}.", variables: { concern: ["the implementation cost", "the tight timeline", "the learning curve for the team", "the impact on existing systems", "the maintenance burden"] } },
    { pattern: "I'd like to play devil's advocate here. What if + clause?", structure: "I'd like to play devil's advocate here. What if {scenario}?", variables: { scenario: ["the market shifts before we launch", "our competitor beats us to it", "the technology doesn't work as expected", "we underestimate the effort", "the client changes their mind"] } },
  ],
  'Status Updates': [
    { pattern: "I'm currently working on + noun phrase and should have it done by + time.", structure: "I'm currently working on {task} and should have it done by {time}.", variables: { task: ["the quarterly report", "the API integration", "the UI mockups", "the bug fixes", "the documentation"], time: ["end of day", "this Friday", "the end of the week", "tomorrow afternoon", "next Monday"] } },
    { pattern: "I've hit a roadblock with + noun phrase. I could use some help with + noun phrase.", structure: "I've hit a roadblock with {problem}. I could use some help with {help_area}.", variables: { problem: ["the database migration", "the third-party API", "the authentication flow", "the deployment pipeline", "the performance optimization"], help_area: ["debugging", "code review", "architecting a solution", "testing", "prioritizing tasks"] } },
    { pattern: "On my end, everything is on track for + noun phrase.", structure: "On my end, everything is on track for {milestone}.", variables: { milestone: ["the release next week", "the client demo on Friday", "the sprint review", "the Q4 launch", "the beta testing phase"] } },
    { pattern: "Just as a heads up, I might need a bit more time on + noun phrase.", structure: "Just as a heads up, I might need a bit more time on {task}.", variables: { task: ["the authentication module", "the data migration", "the performance testing", "the documentation", "the deployment script"] } },
    { pattern: "I've completed + noun phrase and I'm moving on to + noun phrase.", structure: "I've completed {completed} and I'm moving on to {next}.", variables: { completed: ["the initial research", "the prototype", "the code review", "the unit tests", "the UI design"], next: ["the implementation phase", "user testing", "integration testing", "deployment", "the final polish"] } },
    { pattern: "Here's where we stand: + result. The next step is + noun phrase.", structure: "Here's where we stand: {result}. The next step is {next_step}.", variables: { result: ["Development is 80% complete", "Testing is almost done", "The design has been approved", "We're waiting on stakeholder feedback", "The initial data looks promising"], next_step: ["to finalize the deployment", "to run the final tests", "to start development", "to incorporate the feedback", "to proceed with phase two"] } },
    { pattern: "We're making good progress on + noun phrase. So far we've + past participle + noun phrase.", structure: "We're making good progress on {project}. So far we've {achievement}.", variables: { project: ["the platform migration", "the app redesign", "the Q2 planning", "the infrastructure upgrade", "the feature development"], achievement: ["completed the discovery phase", "migrated 60% of the data", "finalized the wireframes", "secured the budget", "shipped the MVP"] } },
    { pattern: "I'll circle back with you once I have more information on + noun phrase.", structure: "I'll circle back with you once I have more information on {topic}.", variables: { topic: ["the exact timeline", "the cost estimate", "the client's feedback", "the technical feasibility", "the resource availability"] } },
  ],
  Deadlines: [
    { pattern: "Is there any flexibility on the deadline for + noun phrase?", structure: "Is there any flexibility on the deadline for {task}?", variables: { task: ["the Q3 report", "the security audit", "the feature rollout", "the compliance review", "the design handoff"] } },
    { pattern: "Could we push the deadline back by + time period?", structure: "Could we push the deadline back by {duration}?", variables: { duration: ["a few days", "one week", "two weeks", "until next month", "a couple of days"] } },
    { pattern: "I'll make sure to have + noun phrase done by + time, no later than + time.", structure: "I'll make sure to have {task} done by {primary}, no later than {fallback}.", variables: { task: ["the final draft", "the code review", "the test results", "the budget proposal", "the project plan"], primary: ["Friday", "the end of the week", "Monday", "the 15th"], fallback: ["Monday", "the following week", "Wednesday", "the 20th"] } },
    { pattern: "What's the latest we can push this without affecting the overall timeline?", structure: "What's the latest we can push {item} without affecting the overall timeline?", variables: { item: ["this deliverable", "this task", "the review phase", "the QA process", "the deployment"] } },
    { pattern: "I'm confident I can wrap up + noun phrase by + time if I focus on it.", structure: "I'm confident I can wrap up {task} by {time} if I focus on it.", variables: { task: ["the remaining tickets", "the pending reviews", "the final edits", "the test suite", "the import script"], time: ["end of day", "tomorrow", "mid-week", "Friday", "the end of the sprint"] } },
  ],
  Meeting: [
    { pattern: "I'd like to kick things off by + verb-ing + ...", structure: "I'd like to kick things off by {action}.", variables: { action: ["reviewing the agenda", "summarizing our progress", "sharing the latest updates", "going over the key metrics", "recapping last week's discussion"] } },
    { pattern: "Does anyone have anything to add before we move on?", structure: "Does anyone have anything to add before we move on {topic}?", variables: { topic: ["to the next item", "to the Q&A", "to the action items", "to the wrap-up", "to the planning session"] } },
    { pattern: "Let's park that for now and focus on + noun phrase.", structure: "Let's park that for now and focus on {topic}.", variables: { topic: ["the main agenda", "the immediate priorities", "today's deliverables", "the critical issues", "the budget allocation"] } },
    { pattern: "Can we take this offline and discuss it later? We're running short on time.", structure: "Can we take this offline and discuss it later? {reason}.", variables: { reason: ["We're running short on time", "We need more data first", "This requires a separate discussion", "Not everyone is looped in", "We should involve the stakeholders"] } },
    { pattern: "Let's go around the room and get everyone's input on + noun phrase.", structure: "Let's go around the room and get everyone's input on {topic}.", variables: { topic: ["this proposal", "the current challenges", "the proposed timeline", "the budget allocation", "the Q2 priorities"] } },
    { pattern: "To build on what + person + just said, I'd add that + clause.", structure: "To build on what {person} just said, I'd add that {point}.", variables: { person: ["Sarah", "Alex", "Mike", "Jane", "Tom"], point: ["we should also consider the timeline", "there's a cost implication too", "we need to involve the design team", "this affects our Q4 goals", "there's precedent for this approach"] } },
    { pattern: "Just to keep us on track, we have + number + minutes left for this item.", structure: "Just to keep us on track, we have {number} minutes left for this item.", variables: { number: ["five", "ten", "fifteen", "twenty", "thirty"] } },
    { pattern: "Does anyone have any objections to + verb-ing + noun phrase?", structure: "Does anyone have any objections to {proposal}?", variables: { proposal: ["moving forward with this plan", "approving the budget as is", "assigning this to the frontend team", "setting the deadline for next Friday", "scheduling a follow-up meeting"] } },
    { pattern: "I think we've covered everything on the agenda. Let's + verb + noun phrase.", structure: "I think we've covered everything on the agenda. Let's {action}.", variables: { action: ["wrap up here", "summarize the action items", "schedule the next meeting", "share the meeting notes", "get this into the sprint backlog"] } },
  ],
  Feedback: [
    { pattern: "I really liked how you + verb + noun phrase. That was + adjective.", structure: "I really liked how you {action}. That was {praise}.", variables: { action: ["handled the client meeting", "structured the presentation", "resolved the conflict", "managed the timeline", "coordinated with the team"], praise: ["impressive", "well done", "excellent", "very professional", "really effective"] } },
    { pattern: "Next time, you might want to + verb + noun phrase for even better results.", structure: "Next time, you might want to {suggestion} for even better results.", variables: { suggestion: ["prepare a backup plan", "involve the team earlier", "document your process", "communicate updates more frequently", "double-check the data"] } },
    { pattern: "Have you thought about + verb-ing + noun phrase? It might help with + noun phrase.", structure: "Have you thought about {action}? It might help with {benefit}.", variables: { action: ["using a template", "setting up automated tests", "creating a checklist", "scheduling regular check-ins", "using version control"], benefit: ["consistency", "quality assurance", "productivity", "team alignment", "collaboration"] } },
    { pattern: "Overall, great work on + noun phrase. The only thing I'd suggest is + verb-ing + noun phrase.", structure: "Overall, great work on {praise_area}. The only thing I'd suggest is {suggestion}.", variables: { praise_area: ["the presentation", "the project delivery", "the code quality", "the client communication", "the team coordination"], suggestion: ["adding more visuals", "improving test coverage", "documenting known issues", "following up sooner", "estimating more accurately"] } },
    { pattern: "One quick observation: + noun phrase could be improved by + verb-ing + noun phrase.", structure: "One quick observation: {area} could be improved by {suggestion}.", variables: { area: ["The error handling", "The documentation", "The test coverage", "The response time", "The user interface"], suggestion: ["adding more descriptive messages", "including code examples", "covering edge cases", "optimizing database queries", "simplifying the navigation"] } },
    { pattern: "I appreciate the effort you put into + noun phrase. It really shows in + noun phrase.", structure: "I appreciate the effort you put into {effort}. It really shows in {result}.", variables: { effort: ["this project", "the presentation", "the codebase cleanup", "the client relationship", "the team building"], result: ["the final product", "the engagement level", "the code quality", "the client satisfaction", "the team morale"] } },
  ],
  Negotiation: [
    { pattern: "I think we're on the same page, but the sticking point seems to be + noun phrase.", structure: "I think we're on the same page, but the sticking point seems to be {issue}.", variables: { issue: ["the budget", "the timeline", "the scope of work", "the resource allocation", "the deliverable quality"] } },
    { pattern: "If you can + verb + noun phrase, we might be able to + verb + noun phrase.", structure: "If you can {concession}, we might be able to {offer}.", variables: { concession: ["extend the deadline", "increase the budget", "provide additional resources", "reduce the scope"], offer: ["deliver higher quality", "expedite the timeline", "include extra features", "provide dedicated support"] } },
    { pattern: "Let's try to find a middle ground. How about + suggestion +?", structure: "Let's try to find a middle ground. How about {compromise}?", variables: { compromise: ["splitting the difference", "a phased approach", "a trial period first", "meeting halfway on the budget", "revisiting this next quarter"] } },
    { pattern: "What would it take for you to + verb + noun phrase?", structure: "What would it take for you to {request}?", variables: { request: ["agree to this timeline", "reduce the price by 10%", "include ongoing support", "expedite the delivery", "take on the additional scope"] } },
    { pattern: "I understand your position, but we're constrained by + noun phrase. Can we work around that?", structure: "I understand your position, but we're constrained by {constraint}. Can we work around that?", variables: { constraint: ["our budget", "the deadline", "our capacity", "company policy", "regulatory requirements"] } },
  ],
  'Problem Solving': [
    { pattern: "Let's break this problem down into smaller pieces. First, + noun phrase.", structure: "Let's break this problem down into smaller pieces. First, {step}.", variables: { step: ["let's identify the root cause", "we need to gather more data", "let's list possible solutions", "we should prioritize the issues", "let's assign ownership"] } },
    { pattern: "What's the root cause here? Is it + noun phrase or + noun phrase?", structure: "What's the root cause here? Is it {cause_a} or {cause_b}?", variables: { cause_a: ["a process issue", "a skills gap", "a communication breakdown", "a resource constraint", "a technical limitation"], cause_b: ["a people problem", "a budget issue", "a planning failure", "a timeline problem", "a scope issue"] } },
    { pattern: "The way I see it, we have three options: + option A, + option B, or + option C.", structure: "The way I see it, we have three options: {option_a}, {option_b}, or {option_c}.", variables: { option_a: ["fix it internally", "do it now", "allocate more resources", "reduce the scope", "hire externally"], option_b: ["outsource it", "delay it", "reallocate existing resources", "increase the timeline", "train existing staff"], option_c: ["shelve it for now", "escalate to management", "find a workaround", "renegotiate the terms", "build a prototype first"] } },
    { pattern: "Let's step back and look at the bigger picture. What are we really trying to + verb + noun phrase?", structure: "Let's step back and look at the bigger picture. What are we really trying to {goal}?", variables: { goal: ["achieve here", "solve for the user", "improve with this change", "prevent from happening", "enable in the long term"] } },
    { pattern: "I think we're overcomplicating this. The simplest solution would be to + verb + noun phrase.", structure: "I think we're overcomplicating this. The simplest solution would be to {action}.", variables: { action: ["ask the user directly", "check the logs", "run a quick experiment", "talk to the stakeholders", "revert the change and test"] } },
  ],
  Apologizing: [
    { pattern: "I apologize for the delay. The issue was + noun phrase, and it's now resolved.", structure: "I apologize for the delay. The issue was {issue}, and it's now resolved.", variables: { issue: ["a technical glitch", "a miscommunication", "an unexpected dependency", "a resource shortage", "a priority shift"] } },
    { pattern: "You're right, that was my oversight. I'll make sure to + verb + noun phrase moving forward.", structure: "You're right, that was my oversight. I'll make sure to {action} moving forward.", variables: { action: ["double-check the details", "communicate updates promptly", "follow the proper process", "include you in the loop", "review before submitting"] } },
    { pattern: "I'm sorry for the confusion. Let me clarify + noun phrase.", structure: "I'm sorry for the confusion. Let me clarify {topic}.", variables: { topic: ["what happened", "the next steps", "the correct process", "the miscommunication", "my original intent"] } },
    { pattern: "Please accept my apologies for + noun phrase. I understand it caused + noun phrase.", structure: "Please accept my apologies for {mistake}. I understand it caused {impact}.", variables: { mistake: ["the missed deadline", "the miscommunication", "the error in the report", "the delayed response", "the oversight"], impact: ["inconvenience", "confusion", "extra work for the team", "a delay in the project", "frustration"] } },
    { pattern: "That shouldn't have happened. Let me + verb + noun phrase to make it right.", structure: "That shouldn't have happened. Let me {action} to make it right.", variables: { action: ["fix the issue immediately", "escalate this to the right team", "personally take care of this", "ensure it doesn't happen again", "follow up with the relevant people"] } },
  ],
  Requests: [
    { pattern: "Would it be possible to + verb + noun phrase + by + time?", structure: "Would it be possible to {action} by {time}?", variables: { action: ["review this document", "provide your feedback", "complete the draft", "approve the budget", "sign off on the design"], time: ["end of day", "tomorrow morning", "Wednesday", "the end of the week", "next Monday"] } },
    { pattern: "Could you point me in the right direction for + noun phrase?", structure: "Could you point me in the right direction for {topic}?", variables: { topic: ["finding the relevant documentation", "understanding this process", "getting access to the system", "contacting the right person", "resolving this issue"] } },
    { pattern: "I'd really appreciate it if you could + verb + noun phrase.", structure: "I'd really appreciate it if you could {action}.", variables: { action: ["take a look at this", "review my pull request", "cover for me in the meeting", "share the meeting notes", "give me some feedback"] } },
    { pattern: "Would you mind + verb-ing + noun phrase?", structure: "Would you mind {action}?", variables: { action: ["proofreading this email", "checking my code", "holding the meeting without me", "switching to the afternoon slot", "sending me the file"] } },
    { pattern: "Could I grab + number + minutes of your time to + verb + noun phrase?", structure: "Could I grab {number} minutes of your time to {purpose}?", variables: { number: ["five", "ten", "fifteen", "twenty", "thirty"], purpose: ["discuss the project", "get your input", "review the design", "ask for your advice", "walk through the proposal"] } },
    { pattern: "Is there any chance you could + verb + noun phrase?", structure: "Is there any chance you could {action}?", variables: { action: ["take over this task for me", "swap shifts this week", "look at this urgent issue", "cover the afternoon session", "help with the presentation"] } },
  ],
  'Small Talk': [
    { pattern: "How's your day going so far? + follow-up question?", structure: "How's your day going so far? {follow_up}.", variables: { follow_up: ["Busy morning?", "Get up to anything fun this weekend?", "How was your vacation?", "Seen any good movies lately?", "Tried any new restaurants recently?"] } },
    { pattern: "I heard you're working on + noun phrase. How's that coming along?", structure: "I heard you're working on {project}. How's that coming along?", variables: { project: ["the new feature", "the redesign project", "the migration", "the presentation", "the client account"] } },
    { pattern: "We should grab coffee sometime and + verb + noun phrase.", structure: "We should grab coffee sometime and {activity}.", variables: { activity: ["catch up", "discuss the project", "share ideas", "talk about the upcoming sprint", "get to know each other"] } },
    { pattern: "Have you worked on + noun phrase before? I'd love to hear about your experience.", structure: "Have you worked on {topic} before? I'd love to hear about your experience.", variables: { topic: ["something similar", "a project like this", "this tech stack", "a remote team setup", "an agile transformation"] } },
    { pattern: "What do you think about + noun phrase? I've been curious about it.", structure: "What do you think about {topic}? I've been curious about it.", variables: { topic: ["the new office layout", "the recent company announcement", "the new project management tool", "the team restructuring", "the conference next month"] } },
  ],
  Opinions: [
    { pattern: "Personally, I think + clause, but I'm open to other suggestions.", structure: "Personally, I think {opinion}, but I'm open to other suggestions.", variables: { opinion: ["we should go with option A", "this is the safest approach", "we're overcomplicating this", "less is more in this case", "we need more data first"] } },
    { pattern: "From my perspective, + clause. What do you all think?", structure: "From my perspective, {viewpoint}. What do you all think?", variables: { viewpoint: ["this is the most efficient path", "we're underestimating the effort", "the risks outweigh the benefits", "this aligns with our goals", "we might be moving too fast"] } },
    { pattern: "I've been thinking about this, and my take is that + clause.", structure: "I've been thinking about this, and my take is that {conclusion}.", variables: { conclusion: ["we need to pivot", "the current strategy is working", "we should invest more in this area", "we're missing the mark", "there's a better way to approach this"] } },
    { pattern: "If you ask me, + clause. But that's just my two cents.", structure: "If you ask me, {opinion}. But that's just my two cents.", variables: { opinion: ["I think we're on the right track", "we should focus on quality over speed", "simplicity is key here", "we need to communicate better", "this needs more testing before launch"] } },
    { pattern: "I'm leaning towards + noun phrase because + clause.", structure: "I'm leaning towards {preference} because {reason}.", variables: { preference: ["option A", "the simpler solution", "going with the vendor", "the phased approach", "the more conservative estimate"], reason: ["it's more cost-effective", "it reduces risk", "it's faster to implement", "it's been proven to work", "it aligns with our long-term goals"] } },
    { pattern: "Has anyone considered the possibility that + clause?", structure: "Has anyone considered the possibility that {possibility}?", variables: { possibility: ["we might be wrong about this", "the client might change their mind", "there could be hidden costs", "we might need more time than expected", "the competition might beat us to market"] } },
  ],
  'Email & Writing': [
    { pattern: "Please find attached + noun phrase. Let me know if you have any questions.", structure: "Please find attached {document}. Let me know if you have any questions.", variables: { document: ["the revised proposal", "the meeting notes", "the quarterly report", "the updated schedule", "the budget breakdown"] } },
    { pattern: "Just a quick reminder that + noun phrase is due by + time.", structure: "Just a quick reminder that {item} is due by {deadline}.", variables: { item: ["the timesheet", "the expense report", "the progress update", "the performance review", "the project plan"], deadline: ["end of day Friday", "tomorrow at 5 PM", "the end of the month", "this Wednesday", "next Monday"] } },
    { pattern: "Following up on + noun phrase. Have you had a chance to + verb + noun phrase?", structure: "Following up on {previous_topic}. Have you had a chance to {action}?", variables: { previous_topic: ["our last conversation", "my previous email", "the meeting last week", "the proposal I sent", "the action items"], action: ["review the document", "provide your feedback", "discuss this with your team", "look into the issue", "approve the request"] } },
    { pattern: "I'm writing to inform you that + clause.", structure: "I'm writing to inform you that {news}.", variables: { news: ["the project timeline has been updated", "the meeting has been rescheduled", "the budget has been approved", "we've completed the initial review", "there's been a change in requirements"] } },
    { pattern: "Could you please + verb + noun phrase at your earliest convenience?", structure: "Could you please {action} at your earliest convenience?", variables: { action: ["review the attached document", "fill out the survey", "confirm your availability", "approve the purchase order", "update the project status"] } },
    { pattern: "Thank you for your prompt response regarding + noun phrase.", structure: "Thank you for your prompt response regarding {topic}.", variables: { topic: ["the budget approval", "the project update", "the feedback on my proposal", "the client meeting confirmation", "the resource allocation"] } },
    { pattern: "I've CC'd + person + on this email so they're in the loop on + noun phrase.", structure: "I've CC'd {person} on this email so they're in the loop on {topic}.", variables: { person: ["Sarah", "the project manager", "the team lead", "the stakeholder", "the account manager"], topic: ["the latest developments", "our discussion", "the budget changes", "the timeline updates", "the client feedback"] } },
  ],
  Encouragement: [
    { pattern: "You're doing a great job on + noun phrase. Keep it up!", structure: "You're doing a great job on {task}. Keep it up!", variables: { task: ["this project", "the presentation prep", "the client management", "the code refactoring", "the team coordination"] } },
    { pattern: "Don't worry, everyone makes mistakes. The important thing is + noun phrase.", structure: "Don't worry, everyone makes mistakes. The important thing is {lesson}.", variables: { lesson: ["we learned from it", "we fixed it quickly", "we have a plan going forward", "it's caught early", "we can improve the process"] } },
    { pattern: "I'm confident that + subject + can + verb + noun phrase. You've got this!", structure: "I'm confident that {subject} can {action}. You've got this!", variables: { subject: ["you", "the team", "we"], action: ["handle this challenge", "deliver on time", "figure this out", "turn this around", "make it work"] } },
    { pattern: "You've made a lot of progress on + noun phrase. Don't give up now!", structure: "You've made a lot of progress on {project}. Don't give up now!", variables: { project: ["this feature", "the refactoring work", "the learning curve", "the client relationship", "the team building"] } },
    { pattern: "I really admire how you + verb + noun phrase. Keep up the great attitude!", structure: "I really admire how you {action}. Keep up the great attitude!", variables: { action: ["handled that difficult situation", "stay positive under pressure", "go above and beyond for the team", "take ownership of problems", "help others grow"] } },
    { pattern: "This is challenging, but if anyone can do it, + subject + can.", structure: "This is challenging, but if anyone can do it, {subject} can.", variables: { subject: ["you", "this team", "we"] } },
    { pattern: "Remember, progress over perfection. You're moving in the right direction.", structure: "Remember, progress over perfection. {encouragement}.", variables: { encouragement: ["Every step forward counts", "Small wins add up", "You're learning and growing", "The important thing is to keep moving", "You're further along than yesterday"] } },
  ],
};

let idCounter = 13;
const newPatterns = [];

let reachedLimit = false;
for (const [category, patterns] of Object.entries(categories)) {
  if (reachedLimit) break;
  const existingCount = existing.filter(p => p.category === category).length;

  for (let i = 0; i < patterns.length; i++) {
    if (newPatterns.length >= 88) { reachedLimit = true; break; }
    const p = patterns[i];

    const meta = { usage: vietMap[category] || "", context: contextMap[category] || "" };

    newPatterns.push({
      id: `pat-${idCounter++}`,
      category,
      example: generateExample(p.structure, p.variables),
      vietnamese: generateVietnamese(category, p.structure),
      pattern: p.pattern,
      structure: p.structure,
      variables: p.variables,
      usage: meta.usage,
      context: meta.context,
      examples: generateExamples(p.structure, p.variables, category),
      keywords: generateKeywords(p.pattern),
    });
  }
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateExample(structure, variables) {
  let sentence = structure;
  for (const [key, options] of Object.entries(variables)) {
    sentence = sentence.replace(`{${key}}`, pickRandom(options));
  }
  sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
  if (!sentence.endsWith('?') && !sentence.endsWith('.') && !sentence.endsWith('!')) {
    sentence += '.';
  }
  return sentence;
}

function generateVietnamese(category, structure) {
  return `Mẫu câu: ${vietMap[category] || category}`;
}

function generateExamples(structure, variables, category) {
  const examples = [];
  for (let i = 0; i < 3; i++) {
    const en = generateExample(structure, variables);
    examples.push({
      en,
      vi: `Ví dụ minh họa cho mẫu câu "${extractShortPattern(structure)}"`,
    });
  }
  return examples;
}

function extractShortPattern(structure) {
  return structure.split(/\{[^}]+\}/).join('...').substring(0, 40);
}

function generateKeywords(pattern) {
  const words = pattern.toLowerCase().replace(/[+?.,!()]/g, '').split(' ');
  const meaningful = words.filter(w => w.length > 3 && !['that', 'this', 'with', 'from', 'have', 'been', 'will', 'could', 'would', 'should', 'might', 'about', 'there', 'where', 'which'].includes(w));
  return [...new Set(meaningful)].slice(0, 5);
}

// Merge with existing patterns
const allPatterns = [...existing, ...newPatterns];

fs.writeFileSync(
  path.join(__dirname, '..', 'web', 'public', 'assets', 'data', 'patterns.json'),
  JSON.stringify(allPatterns, null, 2),
  'utf-8'
);

console.log(`Done! ${existing.length} existing + ${newPatterns.length} new = ${allPatterns.length} total patterns`);
console.log('Categories:', [...new Set(allPatterns.map(p => p.category))].join(', '));
