using System.Collections.Generic;

namespace canvasplanner.Data;

using Microsoft.EntityFrameworkCore;

public class DiagramDbContext : DbContext
{
    public DiagramDbContext(DbContextOptions<DiagramDbContext> options)
        : base(options)
    {
    }

    public DbSet<DiagramState> Diagrams => Set<DiagramState>();
    public DbSet<BlockExecution> BlockExecutions => Set<BlockExecution>();
}
