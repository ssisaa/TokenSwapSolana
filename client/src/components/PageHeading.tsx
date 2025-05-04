import React from 'react';

interface PageHeadingProps {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
}

export default function PageHeading({ title, subtitle, icon }: PageHeadingProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
      <div className="flex items-center">
        {icon && <div className="mr-3">{icon}</div>}
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="text-gray-400 mt-1">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}