import React from 'react';

interface PageTitleProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export default function PageTitle({ title, description, actions }: PageTitleProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-4 md:space-y-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-1">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex space-x-3">
          {actions}
        </div>
      )}
    </div>
  );
}