'use client'

export default function EmptyState({ 
  title = 'No data available', 
  description = 'There is no data to display at this time.', 
  icon = null,
  action = null 
}) {
  return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4 border rounded-lg p-8 text-center">
      {icon && (
        <div className="p-3 rounded-full bg-muted/10">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        {description}
      </p>
      {action && (
        <div className="pt-2">
          {action}
        </div>
      )}
    </div>
  )
}
