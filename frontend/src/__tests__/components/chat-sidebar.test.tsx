import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatSidebar } from "@/components/layout/chat-sidebar";
import { Conversation } from "@/types/chat";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: "u-1", email: "user@example.com", full_name: "Pal Dhaduk" },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe("ChatSidebar Component", () => {
  const sampleConversations: Conversation[] = [
    {
      id: "c-1",
      title: "Pinned Chat",
      pinned: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "c-2",
      title: "Recent Chat",
      pinned: false,
      created_at: "2026-01-02T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    },
  ];

  it("renders New Chat button and user profile", () => {
    render(
      <ChatSidebar
        isOpen={true}
        onClose={vi.fn()}
        onNewChat={vi.fn()}
        isLoading={false}
        conversations={sampleConversations}
        currentConversationId="c-1"
        onSelectConversation={vi.fn()}
        onDeleteConversation={vi.fn()}
        onTogglePin={vi.fn()}
        onRenameConversation={vi.fn()}
      />
    );

    expect(screen.getByText("New chat")).toBeInTheDocument();
    expect(screen.getByText("Pal Dhaduk")).toBeInTheDocument();
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
  });

  it("calls onNewChat when New Chat button is clicked", () => {
    const onNewChat = vi.fn();
    render(
      <ChatSidebar
        isOpen={true}
        onClose={vi.fn()}
        onNewChat={onNewChat}
        isLoading={false}
        conversations={sampleConversations}
        currentConversationId="c-1"
        onSelectConversation={vi.fn()}
        onDeleteConversation={vi.fn()}
        onTogglePin={vi.fn()}
        onRenameConversation={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("New chat"));
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it("renders both Pinned and Recents sections distinctly", () => {
    render(
      <ChatSidebar
        isOpen={true}
        onClose={vi.fn()}
        onNewChat={vi.fn()}
        isLoading={false}
        conversations={sampleConversations}
        currentConversationId="c-1"
        onSelectConversation={vi.fn()}
        onDeleteConversation={vi.fn()}
        onTogglePin={vi.fn()}
        onRenameConversation={vi.fn()}
      />
    );

    expect(screen.getByText("Pinned")).toBeInTheDocument();
    expect(screen.getByText("Pinned Chat")).toBeInTheDocument();

    expect(screen.getByText("Recents")).toBeInTheDocument();
    expect(screen.getByText("Recent Chat")).toBeInTheDocument();
  });

  it("calls onSelectConversation when a conversation item is clicked", () => {
    const onSelect = vi.fn();
    render(
      <ChatSidebar
        isOpen={true}
        onClose={vi.fn()}
        onNewChat={vi.fn()}
        isLoading={false}
        conversations={sampleConversations}
        currentConversationId="c-1"
        onSelectConversation={onSelect}
        onDeleteConversation={vi.fn()}
        onTogglePin={vi.fn()}
        onRenameConversation={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Recent Chat"));
    expect(onSelect).toHaveBeenCalledWith("c-2");
  });

  it("renders empty state message when conversation list is empty", () => {
    render(
      <ChatSidebar
        isOpen={true}
        onClose={vi.fn()}
        onNewChat={vi.fn()}
        isLoading={false}
        conversations={[]}
        currentConversationId={null}
        onSelectConversation={vi.fn()}
        onDeleteConversation={vi.fn()}
        onTogglePin={vi.fn()}
        onRenameConversation={vi.fn()}
      />
    );

    expect(screen.getByText(/No chats yet\./i)).toBeInTheDocument();
  });
});
