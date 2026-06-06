Casefront

Transform legal conversations into structured case reports.

AI-powered legal intake platform for solo attorneys and small law firms.

<p align="center">
  <img src="docs/casefront_overview.png" width="1000">
</p>

Live Demo: https://casefront.app/

The platform helps law firms capture client inquiries, process consultation conversations, and organize potential cases into a structured workflow.

Instead of manually reviewing chat conversations, consultation notes, and recorded meetings, attorneys receive organized case summaries, timelines, and intake reports that can be reviewed from a single dashboard.

The Problem

Most law firms still rely on a fragmented intake process.

Potential clients contact firms through:

Website contact forms
Online chat
Phone consultations
In-person consultations

The information collected is often incomplete, inconsistent, and spread across multiple systems.

Attorneys and legal assistants spend significant time:

Collecting missing information
Reviewing consultation notes
Organizing client details
Creating case summaries
Tracking follow-up actions

As inquiry volume grows, intake becomes difficult to scale.

The Solution

Casefront converts conversations into structured case reports.

Whether the conversation happens through an AI chatbot or a recorded consultation, Casefront extracts relevant information and presents it in a format attorneys can immediately review.

Potential Client
        │
        ├─────────────┐
        │             │
        ▼             ▼

AI Chat Intake    Consultation Recording

        │             │
        └──────┬──────┘
               ▼

      AI Case Processing

               ▼

      Structured Case Report

               ▼

      Attorney Dashboard
Repository Structure
apps/
├── landing
├── chat
├── recording
└── dashboard
Landing

Marketing website for Casefront.

Explains product capabilities, collects leads, and demonstrates the legal intake workflow.

Chat

24/7 AI legal intake assistant.

Designed to be embedded directly into a law firm's website to:

Answer common questions
Collect case information
Qualify leads
Schedule consultations
Recording

Audio-to-report processing pipeline.

Converts phone consultations and in-person consultation recordings into structured legal intake reports.

Generated outputs include:

Case summaries
Timelines
Key facts
Follow-up items
Dashboard

Attorney-facing workspace.

A Jira-like dashboard that allows attorneys to:

Review intake reports
Organize prospective clients
Track case progress
Manage intake workflows
Technology Stack
Frontend
Next.js
React
TypeScript
Tailwind CSS
Backend
Supabase
PostgreSQL
AI
OpenAI API
Structured Information Extraction
Summarization Pipelines
Infrastructure
Vercel
GitHub Actions
Future Roadmap
Multi-language support
SMS intake
Email intake
Voice transcription
Automated appointment scheduling
CRM integrations
Practice management integrations
Document generation
Vision

Law firms should spend less time organizing conversations and more time practicing law.

Casefront aims to become the operating system for legal intake workflows.
